"""Ollama LLM provider - supports local and remote instances."""

import json
import logging
from typing import AsyncIterator

import httpx

from . import (
    BaseLLMProvider, ChatRequest, StreamChunk, register_provider
)

logger = logging.getLogger(__name__)


@register_provider("ollama")
class OllamaProvider(BaseLLMProvider):

    def __init__(self, config: dict):
        super().__init__(config)
        base = config.get("base_url", "http://localhost:11434").rstrip("/")
        # Normalize: strip trailing /api so endpoint paths (/api/chat, /api/tags)
        # work for both local (http://localhost:11434) and cloud (https://ollama.com/api)
        if base.endswith("/api"):
            base = base[:-4]
        self.base_url = base
        api_key = config.get("api_key", "")
        # Build auth header for Ollama Cloud (Bearer token)
        self._headers = {}
        if api_key and not api_key.startswith("${"):
            self._headers["Authorization"] = f"Bearer {api_key}"

    def is_available(self) -> bool:
        """Check if Ollama server is reachable."""
        try:
            import httpx
            with httpx.Client(timeout=3) as client:
                resp = client.get(f"{self.base_url}/api/tags", headers=self._headers)
                return resp.status_code == 200
        except Exception:
            return False

    def list_models(self) -> list[dict]:
        """Return configured models (or query Ollama for installed models)."""
        configured = self.config.get("models", [])
        if configured:
            return configured
        try:
            with httpx.Client(timeout=5) as client:
                resp = client.get(f"{self.base_url}/api/tags", headers=self._headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {"id": m["name"], "name": m["name"]}
                        for m in data.get("models", [])
                    ]
        except Exception:
            pass
        return []

    def _build_messages(self, messages, system_prompt="") -> list[dict]:
        result = []
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        for msg in messages:
            result.append({"role": msg.role, "content": msg.content})
        return result

    def _convert_tools(self, tools) -> list[dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]

    async def chat(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        payload = {
            "model": request.model,
            "messages": self._build_messages(request.messages, request.system_prompt),
            "stream": True,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            },
        }
        if request.tools:
            payload["tools"] = self._convert_tools(request.tools)

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=payload,
                    headers=self._headers,
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        msg = data.get("message", {})

                        if msg.get("tool_calls"):
                            for tc in msg["tool_calls"]:
                                yield StreamChunk(tool_call={
                                    "name": tc["function"]["name"],
                                    "arguments": json.dumps(
                                        tc["function"].get("arguments", {})
                                    ),
                                })

                        content = msg.get("content", "")
                        if content:
                            yield StreamChunk(content=content)

                        if data.get("done", False):
                            usage_data = None
                            prompt_tokens = data.get("prompt_eval_count", 0)
                            completion_tokens = data.get("eval_count", 0)
                            if prompt_tokens or completion_tokens:
                                usage_data = {
                                    "prompt_tokens": prompt_tokens,
                                    "completion_tokens": completion_tokens,
                                    "total_tokens": prompt_tokens + completion_tokens,
                                }
                            yield StreamChunk(done=True, usage=usage_data)
        except httpx.ConnectError:
            yield StreamChunk(
                content="Cannot connect to Ollama. Ensure it is running.",
                done=True,
            )
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            yield StreamChunk(content=f"Error: {e}", done=True)

    async def chat_sync(self, request: ChatRequest) -> str:
        payload = {
            "model": request.model,
            "messages": self._build_messages(request.messages, request.system_prompt),
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            },
        }
        if request.tools:
            payload["tools"] = self._convert_tools(request.tools)

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{self.base_url}/api/chat", json=payload,
                    headers=self._headers,
                )
                data = resp.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            return f"Error: {e}"
