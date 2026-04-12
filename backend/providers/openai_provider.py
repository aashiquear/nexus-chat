"""OpenAI LLM provider."""

import json
import logging
from typing import AsyncIterator

from . import (
    BaseLLMProvider, ChatRequest, StreamChunk, register_provider
)

logger = logging.getLogger(__name__)


@register_provider("openai")
class OpenAIProvider(BaseLLMProvider):

    def __init__(self, config: dict):
        super().__init__(config)
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                api_key = self.config.get("api_key", "")
                if not api_key or api_key.startswith("${"):
                    return None
                self._client = AsyncOpenAI(api_key=api_key)
            except ImportError:
                logger.warning("openai package not installed")
                return None
        return self._client

    def is_available(self) -> bool:
        return self._get_client() is not None

    def list_models(self) -> list[dict]:
        return self.config.get("models", [])

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

    def _build_messages(self, messages, system_prompt="") -> list[dict]:
        result = []
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        for msg in messages:
            result.append({"role": msg.role, "content": msg.content})
        return result

    async def chat(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        client = self._get_client()
        if not client:
            yield StreamChunk(content="OpenAI provider not configured.", done=True)
            return

        kwargs = {
            "model": request.model,
            "messages": self._build_messages(request.messages, request.system_prompt),
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if request.tools:
            kwargs["tools"] = self._convert_tools(request.tools)

        try:
            usage_data = None
            stream = await client.chat.completions.create(**kwargs)
            async for chunk in stream:
                # Capture usage from the final chunk
                if hasattr(chunk, "usage") and chunk.usage:
                    usage_data = {
                        "prompt_tokens": chunk.usage.prompt_tokens or 0,
                        "completion_tokens": chunk.usage.completion_tokens or 0,
                        "total_tokens": chunk.usage.total_tokens or 0,
                    }

                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield StreamChunk(content=delta.content)
                elif delta and delta.tool_calls:
                    for tc in delta.tool_calls:
                        yield StreamChunk(
                            tool_call={
                                "id": tc.id,
                                "name": getattr(tc.function, "name", None),
                                "arguments": getattr(tc.function, "arguments", ""),
                            }
                        )
                if chunk.choices and chunk.choices[0].finish_reason:
                    yield StreamChunk(done=True, usage=usage_data)
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            yield StreamChunk(content=f"Error: {e}", done=True)

    async def chat_sync(self, request: ChatRequest) -> str:
        client = self._get_client()
        if not client:
            return "OpenAI provider not configured."

        kwargs = {
            "model": request.model,
            "messages": self._build_messages(request.messages, request.system_prompt),
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
        }
        if request.tools:
            kwargs["tools"] = self._convert_tools(request.tools)

        try:
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"Error: {e}"
