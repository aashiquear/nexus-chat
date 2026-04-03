"""
RAG (Retrieval-Augmented Generation) engine.
Handles document ingestion, chunking, embedding, and retrieval.
"""

import hashlib
import logging
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
        self._collection = None
        self._embedding_fn = None

    def _get_collection(self):
        if self._collection is not None:
            return self._collection
        try:
            import chromadb
            client = chromadb.Client(
                chromadb.Settings(
                    persist_directory=self.persist_dir,
                    anonymized_telemetry=False,
                )
            )
            self._collection = client.get_or_create_collection(
                name="nexus_docs",
                metadata={"hnsw:space": "cosine"},
            )
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

    async def ingest_file(self, filepath: Path, metadata: dict | None = None) -> dict:
        """Read a file, chunk it, and add to the vector store."""
        collection = self._get_collection()
        if collection is None:
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
            return {"error": f"Failed to read file: {e}"}

        # Chunk and store
        chunks = self.chunk_text(text)
        if not chunks:
            return {"error": "No content extracted from file"}

        file_id = hashlib.md5(str(filepath).encode()).hexdigest()[:12]
        ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        meta = metadata or {}
        metadatas = [
            {**meta, "source": filepath.name, "chunk_index": i}
            for i in range(len(chunks))
        ]

        collection.upsert(
            documents=chunks,
            ids=ids,
            metadatas=metadatas,
        )

        return {
            "filename": filepath.name,
            "chunks": len(chunks),
            "file_id": file_id,
        }

    async def query(self, query_text: str, top_k: int | None = None) -> list[dict]:
        """Query the vector store and return relevant chunks."""
        collection = self._get_collection()
        if collection is None:
            return []

        k = top_k or self.top_k
        try:
            results = collection.query(
                query_texts=[query_text],
                n_results=k,
            )

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
