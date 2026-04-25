"""
LLM Provider abstraction layer.
Add new providers by subclassing BaseLLMProvider and registering them.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class Message:
    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_call_id: str | None = None
    tool_calls: list | None = None


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict  # JSON Schema


@dataclass
class StreamChunk:
    content: str = ""
    tool_call: dict | None = None
    done: bool = False
    usage: dict | None = None


@dataclass
class ChatRequest:
    messages: list[Message]
    model: str
    tools: list[ToolDefinition] = field(default_factory=list)
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = True
    system_prompt: str = ""
    # Per-model "thinking" / "reasoning" configuration. None means the
    # model is non-thinking and providers must not send any thinking
    # parameters. Recognized fields (provider-specific subset applies):
    #   enabled: bool       — turn thinking on
    #   level:   str        — "low" | "medium" | "high" (Ollama, OpenAI)
    #   budget_tokens: int  — Anthropic extended-thinking budget
    thinking: dict | None = None


class BaseLLMProvider(ABC):
    """Base class for all LLM providers."""

    name: str = "base"

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def chat(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        """Stream a chat completion response."""
        ...

    @abstractmethod
    async def chat_sync(self, request: ChatRequest) -> str:
        """Non-streaming chat completion."""
        ...

    @abstractmethod
    def list_models(self) -> list[dict]:
        """Return available models for this provider."""
        ...

    def is_available(self) -> bool:
        """Check if the provider is properly configured."""
        return True


# --- Provider Registry ---
_providers: dict[str, type[BaseLLMProvider]] = {}


def register_provider(name: str):
    """Decorator to register an LLM provider class."""
    def decorator(cls):
        _providers[name] = cls
        cls.name = name
        return cls
    return decorator


def get_provider_class(name: str) -> type[BaseLLMProvider] | None:
    return _providers.get(name)


def get_all_provider_classes() -> dict[str, type[BaseLLMProvider]]:
    return dict(_providers)
