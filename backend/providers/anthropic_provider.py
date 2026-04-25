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

    def _build_thinking_kwarg(self, request: ChatRequest) -> dict | None:
        """Translate the generic thinking config into Anthropic's
        ``thinking`` parameter, or return None for non-thinking models."""
        cfg = request.thinking
        if not cfg or not cfg.get("enabled"):
            return None
        # Anthropic requires budget_tokens < max_tokens. Default to a
        # sensible portion of the response budget if the user didn't pin one.
        budget = cfg.get("budget_tokens") or max(1024, request.max_tokens // 2)
        budget = min(budget, max(1024, request.max_tokens - 512))
        return {"type": "enabled", "budget_tokens": int(budget)}

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

        # Extended thinking, when configured for this model. Non-thinking
        # models leave ``thinking`` unset so the request is unchanged.
        thinking_kwarg = self._build_thinking_kwarg(request)
        if thinking_kwarg:
            kwargs["thinking"] = thinking_kwarg
            # API constraint: extended thinking forces temperature=1.
            kwargs["temperature"] = 1.0

        # Track whether the active content block is a "thinking" block so
        # we can bracket those deltas with <think>…</think> for the UI.
        in_thinking_block = False

        try:
            usage_data = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            async with client.messages.stream(**kwargs) as stream:
                async for event in stream:
                    if not hasattr(event, "type"):
                        continue
                    if event.type == "message_start" and hasattr(event, "message"):
                        msg_usage = getattr(event.message, "usage", None)
                        if msg_usage:
                            usage_data["prompt_tokens"] = getattr(msg_usage, "input_tokens", 0)
                    elif event.type == "message_delta":
                        delta_usage = getattr(event, "usage", None)
                        if delta_usage:
                            usage_data["completion_tokens"] = getattr(delta_usage, "output_tokens", 0)
                        usage_data["total_tokens"] = usage_data["prompt_tokens"] + usage_data["completion_tokens"]
                    elif event.type == "content_block_start":
                        block = getattr(event, "content_block", None)
                        block_type = getattr(block, "type", None) if block else None
                        if block_type == "thinking":
                            in_thinking_block = True
                            yield StreamChunk(content="<think>")
                    elif event.type == "content_block_delta":
                        delta = event.delta
                        # Extended-thinking deltas carry their text on a
                        # ``thinking`` attribute (delta type
                        # "thinking_delta"); regular text uses ``text``.
                        thinking_text = getattr(delta, "thinking", None)
                        if thinking_text:
                            if not in_thinking_block:
                                in_thinking_block = True
                                yield StreamChunk(content="<think>")
                            yield StreamChunk(content=thinking_text)
                        elif hasattr(delta, "text") and delta.text:
                            yield StreamChunk(content=delta.text)
                        elif hasattr(delta, "partial_json"):
                            yield StreamChunk(
                                tool_call={"partial": delta.partial_json}
                            )
                    elif event.type == "content_block_stop":
                        if in_thinking_block:
                            in_thinking_block = False
                            yield StreamChunk(content="</think>")
                    elif event.type == "message_stop":
                        if in_thinking_block:
                            in_thinking_block = False
                            yield StreamChunk(content="</think>")
                        yield StreamChunk(done=True, usage=usage_data if usage_data["total_tokens"] > 0 else None)
        except Exception as e:
            logger.error(f"Anthropic error: {e}")
            if in_thinking_block:
                yield StreamChunk(content="</think>")
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
