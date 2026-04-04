# Nexus Chat

A modular, agentic chatbot with RAG support and multi-LLM provider integration. Built with Python (FastAPI) and React, deployable via Docker.

## Features

- **Multi-LLM Support** — Anthropic Claude, OpenAI GPT, and Ollama (local/remote) out of the box
- **Agentic Tool System** — Built-in tools (calculator, code executor, web search, file reader, date/time) with a simple plugin API to add your own
- **MCP Server Integration** — Connect external services via the Model Context Protocol; tools from MCP servers appear in the sidebar alongside built-in tools
- **RAG Integration** — Upload files and get context-aware responses using ChromaDB vector storage
- **Streaming Chat** — Real-time WebSocket streaming for responsive conversations
- **Clean UI** — Minimal, warm-toned interface with sidebar for model/tool/file selection
- **Docker Ready** — Single-command deployment with Docker Compose
- **Config-Driven** — YAML configuration for providers, tools, and RAG settings
- **Open Source** — MIT licensed, designed for extension and contribution

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/aashiquear/nexus-chat.git
cd nexus-chat

# 2. Configure
cp .env.example .env
# Edit .env and add your API keys

# 3. Run
docker compose up --build

# Open http://localhost:8000
```

### Option 2: Local Development

**Prerequisites:** Python 3.11+, Node.js 18+

```bash
# Linux / macOS
bash start_dev.sh

# Windows
start_dev.bat
```

Or manually:

```bash
# Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && npm run build && cd ..

# Run
python -m backend.main
```

Open [http://localhost:8000](http://localhost:8000).

## Configuration

All settings are in `config/settings.yaml`. API keys can be set either in the YAML file directly or via environment variables in `.env`.

### Adding an LLM Provider

Edit `config/settings.yaml` under `providers:`:

```yaml
providers:
  anthropic:
    enabled: true
    api_key: "${ANTHROPIC_API_KEY}"
    default_model: "claude-sonnet-4-20250514"
    models:
      - id: "claude-sonnet-4-20250514"
        name: "Claude Sonnet 4"
        max_tokens: 8192
```

Set the key in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Using Local Ollama

1. Install and run [Ollama](https://ollama.com) on your machine
2. Pull a model: `ollama pull llama3.2`
3. Ensure the config has:

```yaml
providers:
  ollama:
    enabled: true
    base_url: "http://localhost:11434"    # or host.docker.internal for Docker
    models:
      - id: "llama3.2"
        name: "Llama 3.2"
```

## Adding Custom Tools

Creating a new tool takes 3 steps:

### 1. Create a Python file

Create `backend/tools/my_tool.py`:

```python
import json
from . import BaseTool, register_tool

@register_tool("my_tool")
class MyTool(BaseTool):
    name = "my_tool"
    description = "Describe what your tool does"
    parameters = {
        "type": "object",
        "properties": {
            "input": {
                "type": "string",
                "description": "What this parameter does"
            }
        },
        "required": ["input"]
    }

    async def execute(self, **kwargs) -> str:
        result = do_something(kwargs["input"])
        return json.dumps({"result": result})
```

### 2. Add to config

In `config/settings.yaml`:

```yaml
tools:
  my_tool:
    enabled: true
    name: "My Tool"
    description: "Does something useful"
    icon: "wrench"     # Lucide icon name
    config:
      custom_key: "value"   # Accessible via self.config
```

### 3. Import in main.py

Add to `backend/main.py`:

```python
import backend.tools.my_tool
```

Restart the server — the tool appears in the sidebar.

## MCP Server Integration

Nexus Chat can connect to external services via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). MCP servers expose tools over HTTP JSON-RPC 2.0, and their tools appear in the sidebar alongside built-in tools — users can toggle them on/off per conversation.

### Quick Start with the Example Database Server

An example SQLite MCP server is included at `examples/mcp-database-server/`.

```bash
# 1. Start Nexus Chat + the MCP database server
docker compose --profile mcp up --build

# 2. Enable the server in config/settings.yaml
#    Set mcp_servers.database.enabled to true
#    Restart Nexus Chat (or it picks it up on next boot)
```

The database server exposes four tools: `query`, `execute`, `list_tables`, and `describe_table`. Once connected, ask the chatbot things like *"List all tables in the database"* or *"Insert a new note titled 'Hello'"*.

### Connecting Your Own MCP Server

Any HTTP service that implements the MCP JSON-RPC interface can be connected:

**1. Implement the `/rpc` endpoint** with three methods:

| Method | Description |
|---|---|
| `initialize` | Handshake — return server name and version |
| `tools/list` | Return an array of tool definitions (name, description, JSON Schema parameters) |
| `tools/call` | Execute a tool by name with arguments, return the result |

Plus a `GET /health` endpoint for liveness checks.

**2. Add it to `config/settings.yaml`:**

```yaml
mcp_servers:
  my_server:
    enabled: true
    name: "My Service"
    description: "Does something useful"
    url: "http://my-mcp-server:9000"
    icon: "server"       # Lucide icon name
    timeout: 30          # seconds
```

**3. (Optional) Add to `docker-compose.yml`:**

```yaml
services:
  my-mcp-server:
    build: ./path/to/server
    profiles:
      - mcp
    ports:
      - "9000:9000"
```

Restart Nexus Chat — the MCP server's tools appear under the "MCP Servers" section in the sidebar.

### Turning MCP Servers On/Off

- **Config-level:** Set `enabled: false` in `settings.yaml` and restart.
- **Docker-level:** Run without the `mcp` profile: `docker compose up` (no `--profile mcp`).
- **Per-conversation:** Toggle individual MCP tools on/off in the sidebar, just like built-in tools.

## Project Structure

```
nexus-chat/
├── backend/
│   ├── main.py              # FastAPI app, routes, WebSocket
│   ├── config.py             # YAML config loader
│   ├── orchestrator.py        # Chat orchestrator (LLM + tools + MCP + RAG)
│   ├── providers/
│   │   ├── __init__.py        # Base class + registry
│   │   ├── anthropic_provider.py
│   │   ├── openai_provider.py
│   │   └── ollama_provider.py
│   ├── tools/
│   │   ├── __init__.py        # Base class + registry
│   │   ├── builtin.py         # Calculator, code exec, search, etc.
│   │   └── example_tool.py    # Template for custom tools
│   ├── mcp/
│   │   ├── __init__.py        # MCP module entry
│   │   └── client.py          # MCPClient + MCPManager
│   └── rag/
│       ├── __init__.py
│       └── engine.py          # Document ingestion + retrieval
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   ├── components/
│   │   │   ├── Sidebar.jsx    # Model/tool/MCP/file selection
│   │   │   ├── ChatMessage.jsx
│   │   │   └── ChatInput.jsx
│   │   ├── hooks/
│   │   │   ├── useChat.js     # WebSocket hook
│   │   │   └── api.js         # REST API helpers
│   │   └── styles/
│   │       └── global.css     # All styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── examples/
│   └── mcp-database-server/   # Example MCP server (SQLite)
│       ├── server.py
│       ├── Dockerfile
│       └── README.md
├── config/
│   └── settings.yaml          # Main configuration file
├── data/
│   ├── uploads/               # User-uploaded files
│   └── vector_store/          # ChromaDB persistence
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pyproject.toml
├── start_dev.sh               # Linux/macOS dev script
├── start_dev.bat              # Windows dev script
├── .env.example
└── README.md
```

## Architecture

```
┌─────────────┐     WebSocket      ┌───────────────────────────────────┐
│   React UI  │◄───────────────────►│  FastAPI Backend                  │
│             │     REST API        │                                   │
│  • Sidebar  │◄───────────────────►│  ┌─────────────────────────────┐  │
│  • Chat     │                     │  │  Chat Orchestrator          │  │
│  • Input    │                     │  │                             │  │
└─────────────┘                     │  │  ┌─────────┐ ┌──────────┐  │  │
                                    │  │  │Providers│ │  Tools   │  │  │
                                    │  │  │• Claude │ │• Calc    │  │  │
                                    │  │  │• OpenAI │ │• Search  │  │  │
                                    │  │  │• Ollama │ │• Code    │  │  │
                                    │  │  └─────────┘ │• Custom  │  │  │
                                    │  │              └──────────┘  │  │
                                    │  │  ┌──────────────────────┐  │  │
                                    │  │  │  MCP Manager         │  │  │
                                    │  │  │  JSON-RPC clients    │──┼──┼──► MCP Servers
                                    │  │  └──────────────────────┘  │  │   (Docker / remote)
                                    │  │  ┌──────────────────────┐  │  │
                                    │  │  │  RAG Engine          │  │  │
                                    │  │  │  ChromaDB + Chunking │  │  │
                                    │  │  └──────────────────────┘  │  │
                                    │  └─────────────────────────────┘  │
                                    └───────────────────────────────────┘
```

![nexus_chat_architecture](https://github.com/user-attachments/assets/7381800e-dd69-40c2-81cd-6e70b41c592d)

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/models` | GET | List available LLM models |
| `/api/tools` | GET | List available tools |
| `/api/files` | GET | List uploaded files |
| `/api/upload` | POST | Upload a file (multipart) |
| `/api/files/{name}` | DELETE | Delete an uploaded file |
| `/api/mcp/servers` | GET | List MCP servers and status |
| `/api/mcp/servers/{id}/reconnect` | POST | Reconnect an MCP server |
| `/ws/chat` | WebSocket | Streaming chat |

### WebSocket Message Format

**Send:**
```json
{
  "messages": [{"role": "user", "content": "Hello"}],
  "model": "claude-sonnet-4-20250514",
  "tools": ["calculator", "web_search"],
  "files": ["report.pdf"],
  "system_prompt": "You are a helpful assistant."
}
```

**Receive (streamed events):**
```json
{"type": "text", "content": "Hello! "}
{"type": "tool_call", "name": "calculator", "arguments": {"expression": "2+2"}}
{"type": "tool_result", "name": "calculator", "result": "{\"result\": 4}"}
{"type": "text", "content": "The answer is 4."}
{"type": "done"}
```

## Roadmap

- [ ] Conversation history persistence (SQLite)
- [ ] Multi-user authentication
- [x] MCP (Model Context Protocol) server integration
- [ ] Mobile-friendly PWA
- [ ] Electron desktop app (Windows/macOS/Linux)
- [ ] iOS / Android via Capacitor or React Native wrapper
- [ ] Plugin marketplace for community tools
- [ ] Streaming tool execution with progress

## License

MIT — see [LICENSE](LICENSE).
