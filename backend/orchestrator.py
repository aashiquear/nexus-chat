"""
Chat Orchestrator - Core logic that ties LLM providers, tools, and RAG together.
Handles the agentic loop: LLM → tool call → result → LLM.
"""

import json
import logging
from typing import AsyncIterator

from backend.config import get_config, get_enabled_providers, get_enabled_tools
from backend.providers import (
    BaseLLMProvider, ChatRequest, Message, StreamChunk, ToolDefinition,
    get_provider_class,
)
from backend.tools import BaseTool, get_tool_class
from backend.rag.engine import RAGEngine

logger = logging.getLogger(__name__)


class ChatOrchestrator:
    """Orchestrates chat between user, LLM, tools, and RAG."""

    def __init__(self):
        self.config = get_config()
        self._providers: dict[str, BaseLLMProvider] = {}
        self._tools: dict[str, BaseTool] = {}
        self._rag: RAGEngine | None = None
        self._init_providers()
        self._init_tools()
        self._init_rag()

    def _init_providers(self):
        for name, cfg in get_enabled_providers().items():
            cls = get_provider_class(name)
            if cls:
                provider = cls(cfg)
                self._providers[name] = provider
                logger.info(f"Provider '{name}' loaded")

    def _init_tools(self):
        for name, cfg in get_enabled_tools().items():
            cls = get_tool_class(name)
            if cls:
                tool = cls(cfg.get("config", {}))
                self._tools[name] = tool
                logger.info(f"Tool '{name}' loaded")

    def _init_rag(self):
        rag_config = self.config.get("rag", {})
        if rag_config.get("enabled", False):
            self._rag = RAGEngine(rag_config)
            logger.info("RAG engine initialized")

    def get_available_models(self) -> list[dict]:
        """Return all available models across providers."""
        models = []
        for provider_name, provider in self._providers.items():
            for model in provider.list_models():
                models.append({
                    "id": model["id"],
                    "name": model.get("name", model["id"]),
                    "provider": provider_name,
                    "available": provider.is_available(),
                })
        return models

    def get_available_tools(self) -> list[dict]:
        """Return all available tools."""
        tool_configs = get_enabled_tools()
        result = []
        for name, tool in self._tools.items():
            cfg = tool_configs.get(name, {})
            result.append({
                "id": name,
                "name": cfg.get("name", name),
                "description": cfg.get("description", tool.description),
                "icon": cfg.get("icon", "wrench"),
            })
        return result

    def _resolve_provider(self, model_id: str) -> tuple[str, BaseLLMProvider] | None:
        """Find which provider hosts the given model."""
        for name, provider in self._providers.items():
            for model in provider.list_models():
                if model["id"] == model_id:
                    return name, provider
        return None

    async def _execute_tool(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool and return its result."""
        tool = self._tools.get(tool_name)
        if not tool:
            return json.dumps({"error": f"Tool '{tool_name}' not found"})
        try:
            return await tool.execute(**arguments)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _get_rag_context(self, query: str, files: list[str] | None) -> str:
        """Retrieve relevant context from RAG if enabled."""
        if not self._rag or not files:
            return ""
        results = await self._rag.query(query)
        if not results:
            return ""
        context_parts = []
        for r in results:
            source = r["metadata"].get("source", "unknown")
            context_parts.append(f"[From {source}]:\n{r['content']}")
        return "\n\n---\n\n".join(context_parts)

    async def chat_stream(
        self,
        messages: list[dict],
        model_id: str,
        selected_tools: list[str] | None = None,
        selected_files: list[str] | None = None,
        system_prompt: str = "",
    ) -> AsyncIterator[dict]:
        """
        Stream a chat response, handling tool calls in an agentic loop.

        Yields dicts with:
          {"type": "text", "content": "..."}
          {"type": "tool_call", "name": "...", "arguments": {...}}
          {"type": "tool_result", "name": "...", "result": "..."}
          {"type": "done"}
          {"type": "error", "content": "..."}
        """
        # Resolve provider
        resolved = self._resolve_provider(model_id)
        if not resolved:
            yield {"type": "error", "content": f"Model '{model_id}' not found"}
            return

        provider_name, provider = resolved
        if not provider.is_available():
            yield {"type": "error", "content": f"Provider '{provider_name}' is not configured. Check your API key."}
            return

        # Build tool definitions
        tool_defs = []
        if selected_tools:
            for tool_name in selected_tools:
                tool = self._tools.get(tool_name)
                if tool:
                    td = tool.to_definition()
                    tool_defs.append(ToolDefinition(**td))

        # Get RAG context
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        rag_context = await self._get_rag_context(last_user_msg, selected_files)

        # Build system prompt with RAG context
        full_system = system_prompt or "You are a helpful AI assistant."
        if rag_context:
            full_system += (
                "\n\n--- Relevant Context from Uploaded Files ---\n"
                + rag_context
                + "\n--- End Context ---\n"
                "Use the above context to help answer the user's question."
            )

        # Convert messages
        msg_objs = [Message(role=m["role"], content=m["content"]) for m in messages]

        # Build request
        request = ChatRequest(
            messages=msg_objs,
            model=model_id,
            tools=tool_defs,
            system_prompt=full_system,
            stream=True,
        )

        # Agentic loop (max 5 tool rounds)
        for _round in range(5):
            collected_text = ""
            collected_tool_call = None
            tool_call_buffer = ""

            async for chunk in provider.chat(request):
                if chunk.content:
                    collected_text += chunk.content
                    yield {"type": "text", "content": chunk.content}

                if chunk.tool_call:
                    tc = chunk.tool_call
                    if "name" in tc and tc["name"]:
                        collected_tool_call = {"name": tc["name"], "arguments": ""}
                    if "arguments" in tc:
                        tool_call_buffer += tc["arguments"]
                    if "partial" in tc:
                        tool_call_buffer += tc["partial"]

                if chunk.done:
                    break

            # If no tool call, we're done
            if not collected_tool_call:
                yield {"type": "done"}
                return

            # Execute tool
            collected_tool_call["arguments"] = tool_call_buffer
            try:
                args = json.loads(tool_call_buffer) if tool_call_buffer else {}
            except json.JSONDecodeError:
                args = {}

            yield {
                "type": "tool_call",
                "name": collected_tool_call["name"],
                "arguments": args,
            }

            result = await self._execute_tool(collected_tool_call["name"], args)

            yield {
                "type": "tool_result",
                "name": collected_tool_call["name"],
                "result": result,
            }

            # Append assistant + tool result to messages for next round
            msg_objs.append(Message(role="assistant", content=collected_text or f"Using tool: {collected_tool_call['name']}"))
            msg_objs.append(Message(role="user", content=f"Tool '{collected_tool_call['name']}' returned:\n{result}"))
            request.messages = msg_objs

        yield {"type": "done"}

    @property
    def rag_engine(self) -> RAGEngine | None:
        return self._rag
