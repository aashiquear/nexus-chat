"""
Nexus Chat - FastAPI Application
Main entry point for the backend server.
"""

import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Load env vars before importing config
load_dotenv()

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import load_config, get_config
from backend.orchestrator import ChatOrchestrator
from backend import conversations

# Import providers and tools to trigger registration
import backend.providers.anthropic_provider
import backend.providers.openai_provider
import backend.providers.ollama_provider
import backend.tools.builtin
import backend.tools.example_tool
import backend.tools.svg_diagram
import backend.mcp  # noqa: F401 – MCP client module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load config
config = load_config()
app_config = config.get("app", {})

app = FastAPI(
    title=app_config.get("name", "Nexus Chat"),
    version=app_config.get("version", "0.1.0"),
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize orchestrator
orchestrator = ChatOrchestrator()

# Ensure upload directory exists
upload_dir = Path(config.get("uploads", {}).get("upload_directory", "./data/uploads"))
upload_dir.mkdir(parents=True, exist_ok=True)


# ------ Startup event: initialize async services ------

@app.on_event("startup")
async def startup_event():
    """Initialize MCP server connections on startup."""
    await orchestrator.init_mcp()


# ------ REST API Endpoints ------

@app.get("/api/health")
async def health():
    return {"status": "ok", "name": app_config.get("name")}


@app.get("/api/models")
async def list_models():
    """Return all available LLM models."""
    return {"models": orchestrator.get_available_models()}


@app.get("/api/tools")
async def list_tools():
    """Return all available tools."""
    return {"tools": orchestrator.get_available_tools()}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file for RAG and tool use."""
    upload_cfg = config.get("uploads", {})
    max_size = upload_cfg.get("max_file_size_mb", 50) * 1024 * 1024
    allowed = upload_cfg.get("allowed_extensions", [])

    # Check extension
    ext = Path(file.filename).suffix.lower()
    if allowed and ext not in allowed:
        raise HTTPException(400, f"File type '{ext}' not allowed. Allowed: {allowed}")

    # Save file
    filepath = upload_dir / file.filename
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(400, f"File too large. Max: {max_size // (1024*1024)}MB")

    with open(filepath, "wb") as f:
        f.write(content)

    # Ingest into RAG if enabled
    rag_result = {}
    if orchestrator.rag_engine:
        rag_result = await orchestrator.rag_engine.ingest_file(filepath)

    return {
        "filename": file.filename,
        "size": len(content),
        "rag": rag_result,
    }


@app.get("/api/files")
async def list_files():
    """List uploaded files."""
    files = []
    for f in upload_dir.iterdir():
        if f.is_file():
            files.append({
                "name": f.name,
                "size": f.stat().st_size,
                "extension": f.suffix,
            })
    return {"files": files}


@app.delete("/api/files/{filename}")
async def delete_file(filename: str):
    """Delete an uploaded file."""
    filepath = upload_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")

    filepath.unlink()

    # Remove from RAG
    if orchestrator.rag_engine:
        await orchestrator.rag_engine.delete_file(filename)

    return {"deleted": filename}


# ------ MCP Server Endpoints ------

@app.get("/api/mcp/servers")
async def list_mcp_servers():
    """Return all configured MCP servers and their status."""
    return {"servers": orchestrator.get_mcp_servers()}


@app.post("/api/mcp/servers/{server_id}/reconnect")
async def reconnect_mcp_server(server_id: str):
    """Attempt to reconnect to an MCP server."""
    ok = await orchestrator.reconnect_mcp(server_id)
    if not ok:
        raise HTTPException(404, f"MCP server '{server_id}' not found or unreachable")
    return {"status": "connected", "server": server_id}


# ------ Conversation Endpoints ------

from starlette.requests import Request as StarletteRequest


@app.get("/api/conversations")
async def list_conversations_endpoint():
    """List all saved conversations."""
    return {"conversations": conversations.list_conversations()}


@app.get("/api/conversations/{conversation_id}")
async def get_conversation_endpoint(conversation_id: str):
    """Load a specific conversation."""
    data = conversations.get_conversation(conversation_id)
    if not data:
        raise HTTPException(404, "Conversation not found")
    return data


@app.post("/api/conversations")
async def save_conversation_post(request: StarletteRequest):
    """Create or update a conversation."""
    body = await request.json()
    result = conversations.save_conversation(
        conversation_id=body.get("id"),
        messages=body.get("messages", []),
        model=body.get("model", ""),
    )
    return result


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str):
    """Delete a conversation."""
    ok = conversations.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(404, "Conversation not found")
    return {"deleted": conversation_id}


# ------ WebSocket Chat ------

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat."""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            request = json.loads(data)

            messages = request.get("messages", [])
            model = request.get("model", "")
            tools = request.get("tools", [])
            files = request.get("files", [])
            system = request.get("system_prompt", "")

            async for event in orchestrator.chat_stream(
                messages=messages,
                model_id=model,
                selected_tools=tools,
                selected_files=files,
                system_prompt=system,
            ):
                await websocket.send_text(json.dumps(event))

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "content": str(e)})
            )
        except Exception:
            pass


# ------ Serve Frontend ------

frontend_dir = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = frontend_dir / path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dir / "index.html")


def main():
    """Run the server."""
    import uvicorn
    host = app_config.get("host", "0.0.0.0")
    port = app_config.get("port", 8000)
    debug = app_config.get("debug", False)
    logger.info(f"Starting Nexus Chat on {host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=debug)


if __name__ == "__main__":
    main()
