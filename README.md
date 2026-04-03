![nexus_chat_architecture](https://github.com/user-attachments/assets/7381800e-dd69-40c2-81cd-6e70b41c592d)# Nexus Chat

A modular, agentic chatbot with RAG support and multi-LLM provider integration. Built with Python (FastAPI) and React, deployable via Docker.

## Features

- **Multi-LLM Support** — Anthropic Claude, OpenAI GPT, and Ollama (local/remote) out of the box
- **Agentic Tool System** — Built-in tools (calculator, code executor, web search, file reader, date/time) with a simple plugin API to add your own
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

## Project Structure

```
nexus-chat/
├── backend/
│   ├── main.py              # FastAPI app, routes, WebSocket
│   ├── config.py             # YAML config loader
│   ├── orchestrator.py        # Chat orchestrator (LLM + tools + RAG)
│   ├── providers/
│   │   ├── __init__.py        # Base class + registry
│   │   ├── anthropic_provider.py
│   │   ├── openai_provider.py
│   │   └── ollama_provider.py
│   ├── tools/
│   │   ├── __init__.py        # Base class + registry
│   │   ├── builtin.py         # Calculator, code exec, search, etc.
│   │   └── example_tool.py    # Template for custom tools
│   └── rag/
│       ├── __init__.py
│       └── engine.py          # Document ingestion + retrieval
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   ├── components/
│   │   │   ├── Sidebar.jsx    # Model/tool/file selection
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
                                    │  │  │  RAG Engine          │  │  │
                                    │  │  │  ChromaDB + Chunking │  │  │
                                    │  │  └──────────────────────┘  │  │
                                    │  └─────────────────────────────┘  │
                                    └───────────────────────────────────┘
```
![Uploadin<svg width="100%" viewBox="0 0 680 520" xmlns="http://www.w3.org/2000/svg">
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</marker>
<mask id="imagine-text-gaps-h59gkv" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="680" height="520" fill="white"/><rect x="85.361328125" y="52.30549621582031" width="109.27733612060547" height="21.4722957611084" fill="black" rx="2"/><rect x="92.93167114257812" y="72.19439697265625" width="94.13665008544922" height="19.11117458343506" fill="black" rx="2"/><rect x="70.34777069091797" y="108.19438934326172" width="51.30443572998047" height="19.11117458343506" fill="black" rx="2"/><rect x="158.91592407226562" y="108.19438934326172" width="50.16814422607422" height="19.11117458343506" fill="black" rx="2"/><rect x="82.69398498535156" y="158.19439697265625" width="114.61199188232422" height="19.11117458343506" fill="black" rx="2"/><rect x="242.44517517089844" y="104.19439697265625" width="65.10961532592773" height="19.111166954040527" fill="black" rx="2"/><rect x="415.2848815917969" y="52.30549621582031" width="119.4301528930664" height="21.4722957611084" fill="black" rx="2"/><rect x="436.4206237792969" y="72.19439697265625" width="77.1587142944336" height="19.11117458343506" fill="black" rx="2"/><rect x="349.0964050292969" y="108.19438934326172" width="81.80716705322266" height="19.11117458343506" fill="black" rx="2"/><rect x="501.81622314453125" y="108.19438934326172" width="84.36750793457031" height="19.11117458343506" fill="black" rx="2"/><rect x="378.32965087890625" y="158.19439697265625" width="193.3406219482422" height="19.11117458343506" fill="black" rx="2"/><rect x="92.3260726928711" y="275.2638244628906" width="55.34785461425781" height="21.4722957611084" fill="black" rx="2"/><rect x="270.4297790527344" y="275.2638244628906" width="59.14040756225586" height="21.4722957611084" fill="black" rx="2"/><rect x="452.7503356933594" y="275.2638244628906" width="54.49932861328125" height="21.4722957611084" fill="black" rx="2"/><rect x="261.77593994140625" y="236.19439697265625" width="156.44810485839844" height="19.11117458343506" fill="black" rx="2"/><rect x="423.286865234375" y="346.19439697265625" width="103.42618560791016" height="19.11117458343506" fill="black" rx="2"/><rect x="61.751617431640625" y="389.44439697265625" width="66.49677276611328" height="19.11117458343506" fill="black" rx="2"/><rect x="182.79302978515625" y="389.44439697265625" width="74.41390991210938" height="19.11117458343506" fill="black" rx="2"/><rect x="311.268310546875" y="389.44439697265625" width="67.4633560180664" height="19.11117458343506" fill="black" rx="2"/><rect x="435.9547119140625" y="389.44439697265625" width="68.09053039550781" height="19.11117458343506" fill="black" rx="2"/><rect x="555.9178466796875" y="389.44439697265625" width="68.16431427001953" height="19.11117458343506" fill="black" rx="2"/><rect x="166.7574462890625" y="456.26385498046875" width="86.48513793945312" height="21.4722957611084" fill="black" rx="2"/><rect x="106.33119201660156" y="475.4443664550781" width="207.337646484375" height="19.11117458343506" fill="black" rx="2"/><rect x="468.0808410644531" y="467.4444274902344" width="143.83824157714844" height="19.11117458343506" fill="black" rx="2"/></mask></defs>

<!-- Frontend container -->
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="40" y="40" width="200" height="170" rx="16" stroke-width="0.5" style="fill:rgb(225, 245, 238);stroke:rgb(15, 110, 86);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="140" y="68" text-anchor="middle" style="fill:rgb(8, 80, 65);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:auto">React frontend</text>
<text x="140" y="86" text-anchor="middle" style="fill:rgb(15, 110, 86);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Vite + DM Sans</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="60" y="100" width="72" height="36" rx="6" stroke-width="0.5" style="fill:rgb(225, 245, 238);stroke:rgb(15, 110, 86);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="96" y="122" text-anchor="middle" style="fill:rgb(15, 110, 86);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Sidebar</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="148" y="100" width="72" height="36" rx="6" stroke-width="0.5" style="fill:rgb(225, 245, 238);stroke:rgb(15, 110, 86);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="184" y="122" text-anchor="middle" style="fill:rgb(15, 110, 86);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Chat UI</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="60" y="150" width="160" height="36" rx="6" stroke-width="0.5" style="fill:rgb(225, 245, 238);stroke:rgb(15, 110, 86);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="140" y="172" text-anchor="middle" style="fill:rgb(15, 110, 86);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">WebSocket stream</text>
</g>

<!-- Arrow: Frontend -> Backend -->
<line x1="240" y1="125" x2="310" y2="125" marker-end="url(#arrow)" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="275" y="118" text-anchor="middle" style="fill:rgb(61, 61, 58);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">WS / REST</text>

<!-- Backend container -->
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="310" y="40" width="330" height="170" rx="16" stroke-width="0.5" style="fill:rgb(238, 237, 254);stroke:rgb(83, 74, 183);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="475" y="68" text-anchor="middle" style="fill:rgb(60, 52, 137);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:auto">FastAPI backend</text>
<text x="475" y="86" text-anchor="middle" style="fill:rgb(83, 74, 183);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Python 3.11+</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="330" y="100" width="120" height="36" rx="6" stroke-width="0.5" style="fill:rgb(238, 237, 254);stroke:rgb(83, 74, 183);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="390" y="122" text-anchor="middle" style="fill:rgb(83, 74, 183);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Orchestrator</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="468" y="100" width="152" height="36" rx="6" stroke-width="0.5" style="fill:rgb(238, 237, 254);stroke:rgb(83, 74, 183);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="544" y="122" text-anchor="middle" style="fill:rgb(83, 74, 183);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Config loader</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="330" y="150" width="290" height="36" rx="6" stroke-width="0.5" style="fill:rgb(238, 237, 254);stroke:rgb(83, 74, 183);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="475" y="172" text-anchor="middle" style="fill:rgb(83, 74, 183);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Agentic loop (LLM → tool → LLM)</text>
</g>

<!-- LLM Providers -->
<line x1="390" y1="210" x2="390" y2="260" marker-end="url(#arrow)" mask="url(#imagine-text-gaps-h59gkv)" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="40" y="260" width="160" height="44" rx="8" stroke-width="0.5" style="fill:rgb(230, 241, 251);stroke:rgb(24, 95, 165);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="120" y="286" text-anchor="middle" dominant-baseline="central" style="fill:rgb(12, 68, 124);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:central">Claude</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="220" y="260" width="160" height="44" rx="8" stroke-width="0.5" style="fill:rgb(230, 241, 251);stroke:rgb(24, 95, 165);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="300" y="286" text-anchor="middle" dominant-baseline="central" style="fill:rgb(12, 68, 124);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:central">OpenAI</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="400" y="260" width="160" height="44" rx="8" stroke-width="0.5" style="fill:rgb(230, 241, 251);stroke:rgb(24, 95, 165);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="480" y="286" text-anchor="middle" dominant-baseline="central" style="fill:rgb(12, 68, 124);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:central">Ollama</text>
</g>

<text x="340" y="250" text-anchor="middle" style="fill:rgb(61, 61, 58);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">LLM providers (pluggable)</text>

<line x1="120" y1="260" x2="300" y2="210" marker-end="url(#arrow)" stroke="var(--s)" stroke-width="0.5" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<line x1="300" y1="260" x2="380" y2="210" marker-end="url(#arrow)" stroke="var(--s)" stroke-width="0.5" mask="url(#imagine-text-gaps-h59gkv)" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<line x1="480" y1="260" x2="460" y2="210" marker-end="url(#arrow)" stroke="var(--s)" stroke-width="0.5" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

<!-- Tools row -->
<line x1="475" y1="210" x2="475" y2="370" marker-end="url(#arrow)" mask="url(#imagine-text-gaps-h59gkv)" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="475" y="360" text-anchor="middle" style="fill:rgb(61, 61, 58);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:auto">Tools (pluggable)</text>

<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="40" y="375" width="110" height="40" rx="6" stroke-width="0.5" style="fill:rgb(250, 236, 231);stroke:rgb(153, 60, 29);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="95" y="399" text-anchor="middle" dominant-baseline="central" style="fill:rgb(153, 60, 29);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">Calculator</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="165" y="375" width="110" height="40" rx="6" stroke-width="0.5" style="fill:rgb(250, 236, 231);stroke:rgb(153, 60, 29);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="220" y="399" text-anchor="middle" dominant-baseline="central" style="fill:rgb(153, 60, 29);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">Web search</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="290" y="375" width="110" height="40" rx="6" stroke-width="0.5" style="fill:rgb(250, 236, 231);stroke:rgb(153, 60, 29);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="345" y="399" text-anchor="middle" dominant-baseline="central" style="fill:rgb(153, 60, 29);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">Code exec</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="415" y="375" width="110" height="40" rx="6" stroke-width="0.5" style="fill:rgb(250, 236, 231);stroke:rgb(153, 60, 29);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="470" y="399" text-anchor="middle" dominant-baseline="central" style="fill:rgb(153, 60, 29);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">File reader</text>
</g>
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="540" y="375" width="100" height="40" rx="6" stroke-width="0.5" stroke-dasharray="4 3" style="fill:rgb(241, 239, 232);stroke:rgb(95, 94, 90);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-dasharray:4px, 3px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="590" y="399" text-anchor="middle" dominant-baseline="central" style="fill:rgb(95, 94, 90);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">+ your tool</text>
</g>

<!-- RAG -->
<line x1="345" y1="210" x2="200" y2="450" marker-end="url(#arrow)" stroke="var(--s)" stroke-width="0.5" mask="url(#imagine-text-gaps-h59gkv)" style="fill:none;stroke:rgb(115, 114, 108);color:rgb(0, 0, 0);stroke-width:1.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="40" y="445" width="340" height="52" rx="10" stroke-width="0.5" style="fill:rgb(250, 238, 218);stroke:rgb(133, 79, 11);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="210" y="467" text-anchor="middle" dominant-baseline="central" style="fill:rgb(99, 56, 6);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:14px;font-weight:500;text-anchor:middle;dominant-baseline:central">RAG engine</text>
<text x="210" y="485" text-anchor="middle" dominant-baseline="central" style="fill:rgb(133, 79, 11);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">ChromaDB · chunking · embeddings</text>
</g>

<!-- Docker badge -->
<g style="fill:rgb(0, 0, 0);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">
<rect x="440" y="455" width="200" height="36" rx="6" stroke-width="0.5" style="fill:rgb(241, 239, 232);stroke:rgb(95, 94, 90);color:rgb(0, 0, 0);stroke-width:0.5px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
<text x="540" y="477" text-anchor="middle" dominant-baseline="central" style="fill:rgb(95, 94, 90);stroke:none;color:rgb(0, 0, 0);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:&quot;Anthropic Sans&quot;, -apple-system, &quot;system-ui&quot;, &quot;Segoe UI&quot;, sans-serif;font-size:12px;font-weight:400;text-anchor:middle;dominant-baseline:central">Docker compose deploy</text>
</g>

</svg>g nexus_chat_architecture.svg…]()

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/models` | GET | List available LLM models |
| `/api/tools` | GET | List available tools |
| `/api/files` | GET | List uploaded files |
| `/api/upload` | POST | Upload a file (multipart) |
| `/api/files/{name}` | DELETE | Delete an uploaded file |
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
- [ ] MCP (Model Context Protocol) server integration
- [ ] Mobile-friendly PWA
- [ ] Electron desktop app (Windows/macOS/Linux)
- [ ] iOS / Android via Capacitor or React Native wrapper
- [ ] Plugin marketplace for community tools
- [ ] Streaming tool execution with progress

## License

MIT — see [LICENSE](LICENSE).
