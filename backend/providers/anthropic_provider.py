"""Anthropic Claude LLM provider."""

import json
import logging
from typing import AsyncIterator

from . import (
    BaseLLMProvider, ChatRequest, StreamChunk, register_provider
)

logger = logging.getLogger(__name__)


@register_provider("anthropic")
class AnthropicProvider(BaseLLMProvider):

    def __init__(self, config: dict):
        super().__init__(config)
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import anthropic
                api_key = self.config.get("api_key", "")
                if not api_key or api_key.startswith("${"):
                    return None
                self._client = anthropic.AsyncAnthropic(api_key=api_key)
            except ImportError:
                logger.warning("anthropic package not installed")
                return None
        return self._client

    def is_available(self) -> bool:
        return self._get_client() is not None

    def list_models(self) -> list[dict]:
        return self.config.get("models", [])

    def _convert_tools(self, tools) -> list[dict]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            }
            for t in tools
        ]

    def _build_messages(self, messages) -> list[dict]:
        result = []
        for msg in messages:
            if msg.role == "system":
                continue  # Handled separately
            result.append({"role": msg.role, "content": msg.content})
        return result

    async def chat(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        client = self._get_client()
        if not client:
            yield StreamChunk(content="Anthropic provider not configured.", done=True)
            return

        kwargs = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "messages": self._build_messages(request.messages),
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt
        if request.tools:
            kwargs["tools"] = self._convert_tools(request.tools)

        try:
            async with client.messages.stream(**kwargs) as stream:
                async for event in stream:
                    if hasattr(event, "type"):
                        if event.type == "content_block_delta":
                            if hasattr(event.delta, "text"):
                                yield StreamChunk(content=event.delta.text)
                            elif hasattr(event.delta, "partial_json"):
                                yield StreamChunk(
                                    tool_call={"partial": event.delta.partial_json}
                                )
                        elif event.type == "message_stop":
                            yield StreamChunk(done=True)
        except Exception as e:
            logger.error(f"Anthropic error: {e}")
            yield StreamChunk(content=f"Error: {e}", done=True)

    async def chat_sync(self, request: ChatRequest) -> str:
        client = self._get_client()
        if not client:
            return "Anthropic provider not configured."

        kwargs = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "messages": self._build_messages(request.messages),
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt
        if request.tools:
            kwargs["tools"] = self._convert_tools(request.tools)

        try:
            response = await client.messages.create(**kwargs)
            return "".join(
                block.text for block in response.content
                if hasattr(block, "text")
            )
        except Exception as e:
            return f"Error: {e}"
