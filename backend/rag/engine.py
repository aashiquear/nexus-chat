"""
RAG (Retrieval-Augmented Generation) engine.
Handles document ingestion, chunking, embedding, and retrieval.
"""

import hashlib
import logging
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class RAGEngine:
    """Simple RAG engine using ChromaDB for vector storage."""

    def __init__(self, config: dict):
        self.config = config
        self.chunk_size = config.get("chunk_size", 1000)
        self.chunk_overlap = config.get("chunk_overlap", 200)
        self.top_k = config.get("top_k", 5)
        self.persist_dir = config.get("persist_directory", "./data/vector_store")
        # Batch chunks during embedding so we can update progress without
        # holding the GIL on a single huge upsert. 32 is a sensible default
        # for sentence-transformer / ONNX backends; tune via config.
        self.embed_batch_size = config.get("embed_batch_size", 32)
        # Optional cap on tokenizer max length — shorter sequences mean less
        # padding and faster inference for the embedder.
        self.embed_max_length = config.get("embed_max_length", 256)
        self._collection = None
        self._embedding_fn = None
        # Per-file embedding progress: filename -> {stage, current, total, percent}
        self._progress: dict[str, dict] = {}
        self._progress_lock = threading.Lock()

    def _build_embedding_fn(self):
        """Build an ONNX-backed embedding function with optimized session options.

        Falls back to ChromaDB's default if optimization isn't available.
        Optimizations applied (per AWS / ONNX Runtime guidance):
          - graph optimization level = ORT_ENABLE_ALL (operator fusion)
          - intra-op threads scaled to CPU count
          - bounded tokenizer max_length to reduce padding overhead
        """
        try:
            from chromadb.utils import embedding_functions
            ef = embedding_functions.ONNXMiniLM_L6_V2()
            try:
                import os
                import onnxruntime as ort
                so = ort.SessionOptions()
                so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                so.intra_op_num_threads = max(1, (os.cpu_count() or 2))
                # ChromaDB's ONNXMiniLM caches the session on first use as
                # ``_model``; pre-warm with our optimized session so
                # subsequent calls reuse it.
                if hasattr(ef, "_init_model_and_tokenizer"):
                    ef._init_model_and_tokenizer()
                if hasattr(ef, "model") and ef.model is not None:
                    # Replace the default session with an optimized one.
                    model_path = getattr(ef, "DOWNLOAD_PATH", None) or getattr(
                        ef, "_MODEL_DOWNLOAD_PATH", None
                    )
                    if model_path:
                        ef.model = ort.InferenceSession(
                            str(model_path),
                            sess_options=so,
                            providers=["CPUExecutionProvider"],
                        )
                # Cap tokenizer length — see AWS guidance on padding overhead.
                if hasattr(ef, "tokenizer") and ef.tokenizer is not None:
                    try:
                        ef.tokenizer.model_max_length = self.embed_max_length
                    except Exception:
                        pass
            except Exception as opt_err:
                logger.info("ONNX session optimization skipped: %s", opt_err)
            return ef
        except Exception as e:
            logger.info("Custom embedding function unavailable, using default: %s", e)
            return None

    def _get_collection(self):
        if self._collection is not None:
            return self._collection
        try:
            import chromadb
            # Use PersistentClient so embeddings survive container restarts.
            # chromadb.Client() is ephemeral (in-memory only).
            client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=chromadb.Settings(anonymized_telemetry=False),
            )
            if self._embedding_fn is None:
                self._embedding_fn = self._build_embedding_fn()

            kwargs = {
                "name": "nexus_docs",
                "metadata": {"hnsw:space": "cosine"},
            }
            if self._embedding_fn is not None:
                kwargs["embedding_function"] = self._embedding_fn

            self._collection = client.get_or_create_collection(**kwargs)
            return self._collection
        except ImportError:
            logger.warning("chromadb not installed - RAG disabled")
            return None

    def chunk_text(self, text: str) -> list[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk)
            start += self.chunk_size - self.chunk_overlap
        return chunks

    # ------------------------------------------------------------------
    # Progress tracking
    # ------------------------------------------------------------------
    def _set_progress(self, filename: str, **fields):
        with self._progress_lock:
            current = self._progress.get(filename, {"filename": filename})
            current.update(fields)
            self._progress[filename] = current

    def get_progress(self, filename: str) -> dict | None:
        """Return the current embedding progress for a file, if any."""
        with self._progress_lock:
            entry = self._progress.get(filename)
            return dict(entry) if entry else None

    def clear_progress(self, filename: str):
        with self._progress_lock:
            self._progress.pop(filename, None)

    async def ingest_file(self, filepath: Path, metadata: dict | None = None) -> dict:
        """Read a file, chunk it, and add to the vector store.

        Embeds chunks in batches so progress can be reported and very
        large files don't block on a single huge upsert. Progress is
        exposed via :meth:`get_progress` keyed by ``filepath.name``.
        """
        filename = filepath.name
        self._set_progress(
            filename, stage="reading", current=0, total=0, percent=0
        )

        collection = self._get_collection()
        if collection is None:
            self._set_progress(filename, stage="error", percent=0)
            return {"error": "Vector store not available"}

        # Read file content
        ext = filepath.suffix.lower()
        try:
            if ext == ".pdf":
                from PyPDF2 import PdfReader
                reader = PdfReader(str(filepath))
                text = "\n".join(p.extract_text() or "" for p in reader.pages)
            elif ext == ".docx":
                from docx import Document
                doc = Document(str(filepath))
                text = "\n".join(p.text for p in doc.paragraphs)
            else:
                text = filepath.read_text(errors="replace")
        except Exception as e:
            self._set_progress(filename, stage="error", percent=0)
            return {"error": f"Failed to read file: {e}"}

        self._set_progress(filename, stage="chunking", percent=0)
        chunks = self.chunk_text(text)
        if not chunks:
            self._set_progress(filename, stage="error", percent=0)
            return {"error": "No content extracted from file"}

        file_id = hashlib.md5(str(filepath).encode()).hexdigest()[:12]
        meta = metadata or {}
        total = len(chunks)
        batch_size = max(1, int(self.embed_batch_size))

        self._set_progress(
            filename, stage="embedding", current=0, total=total, percent=0
        )

        # Batched embedding/upsert: keeps memory bounded and lets us
        # report progress incrementally to the UI.
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch_chunks = chunks[start:end]
            batch_ids = [f"{file_id}_chunk_{i}" for i in range(start, end)]
            batch_meta = [
                {**meta, "source": filename, "chunk_index": i}
                for i in range(start, end)
            ]
            try:
                collection.upsert(
                    documents=batch_chunks,
                    ids=batch_ids,
                    metadatas=batch_meta,
                )
            except Exception as e:
                logger.error("Embedding batch failed for %s: %s", filename, e)
                self._set_progress(filename, stage="error", percent=0)
                return {"error": f"Embedding failed: {e}"}

            percent = int(end / total * 100)
            self._set_progress(
                filename, stage="embedding", current=end, total=total, percent=percent
            )

        self._set_progress(
            filename, stage="complete", current=total, total=total, percent=100
        )

        return {
            "filename": filename,
            "chunks": total,
            "file_id": file_id,
        }

    async def query(self, query_text: str, top_k: int | None = None, filenames: list[str] | None = None) -> list[dict]:
        """Query the vector store and return relevant chunks.

        Args:
            query_text: The search query.
            top_k: Max results to return.
            filenames: If provided, restrict results to these source files.
        """
        collection = self._get_collection()
        if collection is None:
            return []

        k = top_k or self.top_k
        try:
            query_params = {
                "query_texts": [query_text],
                "n_results": k,
            }
            if filenames:
                if len(filenames) == 1:
                    query_params["where"] = {"source": filenames[0]}
                else:
                    query_params["where"] = {"source": {"$in": filenames}}

            results = collection.query(**query_params)

            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]

            return [
                {
                    "content": doc,
                    "metadata": meta,
                    "score": 1 - dist,  # Convert distance to similarity
                }
                for doc, meta, dist in zip(documents, metadatas, distances)
            ]
        except Exception as e:
            logger.error(f"RAG query error: {e}")
            return []

    async def delete_file(self, filename: str) -> dict:
        """Remove all chunks for a given file from the vector store."""
        collection = self._get_collection()
        if collection is None:
            return {"error": "Vector store not available"}

        try:
            collection.delete(where={"source": filename})
            return {"deleted": filename}
        except Exception as e:
            return {"error": str(e)}

    async def list_files(self) -> list[str]:
        """List all unique source files in the vector store."""
        collection = self._get_collection()
        if collection is None:
            return []
        try:
            all_data = collection.get(include=["metadatas"])
            sources = set()
            for meta in all_data.get("metadatas", []):
                if meta and "source" in meta:
                    sources.add(meta["source"])
            return sorted(sources)
        except Exception:
            return []

    async def sync_uploads(self, upload_dir: Path) -> dict:
        """Re-ingest any uploaded files that are missing from the vector store.

        Called on startup so that files persisted on disk but absent from
        the vector store (e.g. after a container restart with a stale or
        previously-ephemeral DB) are automatically indexed.
        """
        if not upload_dir.is_dir():
            return {"synced": 0}

        indexed = set(await self.list_files())
        synced = 0
        for filepath in upload_dir.iterdir():
            if filepath.is_file() and filepath.name not in indexed:
                logger.info("Re-ingesting uploaded file: %s", filepath.name)
                await self.ingest_file(filepath)
                synced += 1

        if synced:
            logger.info("Synced %d file(s) into vector store", synced)
        return {"synced": synced}
