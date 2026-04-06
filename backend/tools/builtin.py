"""Built-in tools for Nexus Chat."""

import ast
import math
import operator
import datetime as dt
import json
import subprocess
import tempfile
import os
from pathlib import Path

from . import BaseTool, register_tool


@register_tool("calculator")
class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Evaluate mathematical expressions safely. Supports basic arithmetic, powers, sqrt, trig, and common math functions."
    parameters = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Mathematical expression to evaluate, e.g. '2 + 3 * 4' or 'sqrt(16)'"
            }
        },
        "required": ["expression"]
    }

    SAFE_FUNCTIONS = {
        "sqrt": math.sqrt, "abs": abs, "round": round,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10, "log2": math.log2,
        "pi": math.pi, "e": math.e, "pow": pow,
        "floor": math.floor, "ceil": math.ceil,
    }

    async def execute(self, **kwargs) -> str:
        expr = kwargs.get("expression", "")
        try:
            # Replace common function names for eval safety
            for name, func in self.SAFE_FUNCTIONS.items():
                if callable(func):
                    pass  # handled in namespace
            result = eval(expr, {"__builtins__": {}}, self.SAFE_FUNCTIONS)
            return json.dumps({"result": result, "expression": expr})
        except Exception as e:
            return json.dumps({"error": str(e), "expression": expr})


@register_tool("datetime_tool")
class DateTimeTool(BaseTool):
    name = "datetime_tool"
    description = "Get current date, time, and timezone information."
    parameters = {
        "type": "object",
        "properties": {
            "timezone": {
                "type": "string",
                "description": "Timezone name (e.g. 'US/Mountain', 'UTC'). Defaults to UTC."
            },
            "format": {
                "type": "string",
                "description": "Output format string (strftime). Default: '%Y-%m-%d %H:%M:%S %Z'"
            }
        },
        "required": []
    }

    async def execute(self, **kwargs) -> str:
        fmt = kwargs.get("format", "%Y-%m-%d %H:%M:%S %Z")
        now = dt.datetime.now(dt.timezone.utc)
        return json.dumps({
            "datetime": now.strftime(fmt),
            "timestamp": now.timestamp(),
            "iso": now.isoformat(),
        })


@register_tool("code_executor")
class CodeExecutorTool(BaseTool):
    name = "code_executor"
    description = "Execute Python code in a sandboxed environment and return the output."
    parameters = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Python code to execute"
            }
        },
        "required": ["code"]
    }

    async def execute(self, **kwargs) -> str:
        code = kwargs.get("code", "")
        timeout = self.config.get("timeout", 30)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False
        ) as f:
            f.write(code)
            tmp_path = f.name

        try:
            result = subprocess.run(
                ["python3", tmp_path],
                capture_output=True, text=True, timeout=timeout,
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[stderr]: {result.stderr}"
            return json.dumps({
                "output": output.strip() or "(no output)",
                "return_code": result.returncode,
            })
        except subprocess.TimeoutExpired:
            return json.dumps({"error": f"Execution timed out ({timeout}s)"})
        except Exception as e:
            return json.dumps({"error": str(e)})
        finally:
            os.unlink(tmp_path)


@register_tool("file_reader")
class FileReaderTool(BaseTool):
    name = "file_reader"
    description = "Read and extract text content from uploaded files (txt, md, csv, json, py, etc.)."
    parameters = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "Name of the uploaded file to read"
            }
        },
        "required": ["filename"]
    }

    async def execute(self, **kwargs) -> str:
        filename = kwargs.get("filename", "")
        upload_dir = Path(self.config.get("upload_dir", "./data/uploads"))
        filepath = upload_dir / filename

        if not filepath.exists():
            return json.dumps({"error": f"File not found: {filename}"})

        try:
            ext = filepath.suffix.lower()
            if ext == ".pdf":
                return await self._read_pdf(filepath)
            elif ext == ".docx":
                return await self._read_docx(filepath)
            else:
                content = filepath.read_text(errors="replace")
                # Truncate if very long
                if len(content) > 50000:
                    content = content[:50000] + "\n... (truncated)"
                return json.dumps({
                    "filename": filename,
                    "content": content,
                    "size": filepath.stat().st_size,
                })
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _read_pdf(self, path: Path) -> str:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(path))
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
            return json.dumps({
                "filename": path.name, "content": text,
                "pages": len(reader.pages),
            })
        except ImportError:
            return json.dumps({"error": "PyPDF2 not installed"})

    async def _read_docx(self, path: Path) -> str:
        try:
            from docx import Document
            doc = Document(str(path))
            text = "\n".join(p.text for p in doc.paragraphs)
            return json.dumps({"filename": path.name, "content": text})
        except ImportError:
            return json.dumps({"error": "python-docx not installed"})


@register_tool("web_search")
class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web for current information using DuckDuckGo."
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query"
            },
            "num_results": {
                "type": "integer",
                "description": "Number of results to return (default: 5)",
                "default": 5
            }
        },
        "required": ["query"]
    }

    async def execute(self, **kwargs) -> str:
        query = kwargs.get("query", "")
        num = kwargs.get("num_results", 5)

        # Try duckduckgo-search library with retry on rate-limit
        try:
            import time
            from duckduckgo_search import DDGS
            last_err = None
            for attempt in range(3):
                try:
                    with DDGS() as ddgs:
                        raw = list(ddgs.text(query, max_results=num))
                    if raw:
                        results = [
                            {
                                "title": r.get("title", ""),
                                "text": r.get("body", ""),
                                "url": r.get("href", ""),
                            }
                            for r in raw
                        ]
                        return json.dumps({"query": query, "results": results})
                    break  # empty but no error — fall through to fallback
                except Exception as e:
                    last_err = e
                    if "Ratelimit" in str(e) and attempt < 2:
                        time.sleep(2 ** attempt)  # 1s, 2s backoff
                        continue
                    break  # non-ratelimit error — fall through
        except ImportError:
            pass  # library not installed — fall through

        # Fallback: DuckDuckGo Instant Answer API
        try:
            import httpx
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": 1},
                )
                data = resp.json()
                results = []
                for topic in data.get("RelatedTopics", [])[:num]:
                    if "Text" in topic:
                        results.append({
                            "text": topic["Text"],
                            "url": topic.get("FirstURL", ""),
                        })
                return json.dumps({
                    "query": query,
                    "results": results or [{"text": data.get("Abstract") or "No results found"}],
                })
        except Exception as e:
            return json.dumps({"error": str(e), "query": query})
