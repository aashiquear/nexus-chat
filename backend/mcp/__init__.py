"""
MCP (Model Context Protocol) client integration for Nexus Chat.

Connects to external MCP servers over HTTP+SSE and exposes their tools
alongside the built-in tool system. MCP servers are configured in
config/settings.yaml under the ``mcp_servers`` section.

Architecture mirrors the tool system:
  - MCPClient manages the connection to a single MCP server
  - MCPManager handles discovery, lifecycle, and lookup for all servers
  - Tools from MCP servers are surfaced in the orchestrator identically
    to built-in tools (same ToolDefinition / execute interface)
"""

from backend.mcp.client import MCPClient, MCPManager

__all__ = ["MCPClient", "MCPManager"]
