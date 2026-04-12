"""
Conversation persistence — stores chat threads as JSON files locally.

Each conversation is a JSON file in data/conversations/:
  {
    "id": "abc123",
    "title": "First user message (truncated)",
    "model": "claude-sonnet-4-20250514",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:05:00Z",
    "messages": [...]
  }
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

CONVERSATIONS_DIR = Path("./data/conversations")
CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)


def _path(conversation_id: str) -> Path:
    return CONVERSATIONS_DIR / f"{conversation_id}.json"


def _derive_title(messages: list[dict]) -> str:
    """Extract a short title from the first user message."""
    for msg in messages:
        if msg.get("role") == "user" and msg.get("content"):
            text = msg["content"].strip()
            # Truncate to first line, max 60 chars
            first_line = text.split("\n")[0]
            if len(first_line) > 60:
                return first_line[:57] + "..."
            return first_line
    return "New conversation"


def list_conversations() -> list[dict]:
    """Return all conversations sorted by updated_at descending."""
    convos = []
    for f in CONVERSATIONS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            convos.append({
                "id": data["id"],
                "title": data.get("title", "Untitled"),
                "model": data.get("model", ""),
                "created_at": data.get("created_at", ""),
                "updated_at": data.get("updated_at", ""),
                "message_count": len(data.get("messages", [])),
            })
        except Exception as e:
            logger.warning("Failed to read conversation %s: %s", f.name, e)
    convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return convos


def get_conversation(conversation_id: str) -> dict | None:
    """Load a full conversation by ID."""
    path = _path(conversation_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception as e:
        logger.error("Failed to load conversation %s: %s", conversation_id, e)
        return None


def save_conversation(
    conversation_id: str | None,
    messages: list[dict],
    model: str = "",
    token_usage: list[dict] | None = None,
) -> dict:
    """Create or update a conversation. Returns the saved metadata."""
    now = datetime.now(timezone.utc).isoformat()

    if conversation_id:
        existing = get_conversation(conversation_id)
    else:
        existing = None

    if existing:
        existing["messages"] = messages
        existing["model"] = model or existing.get("model", "")
        existing["updated_at"] = now
        existing["title"] = _derive_title(messages)
        if token_usage is not None:
            existing["token_usage"] = token_usage
        data = existing
    else:
        cid = conversation_id or uuid.uuid4().hex[:12]
        data = {
            "id": cid,
            "title": _derive_title(messages),
            "model": model,
            "created_at": now,
            "updated_at": now,
            "messages": messages,
        }
        if token_usage is not None:
            data["token_usage"] = token_usage

    path = _path(data["id"])
    path.write_text(json.dumps(data, indent=2))

    return {
        "id": data["id"],
        "title": data["title"],
        "model": data["model"],
        "created_at": data["created_at"],
        "updated_at": data["updated_at"],
        "message_count": len(messages),
    }


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation file. Returns True if deleted."""
    path = _path(conversation_id)
    if path.exists():
        path.unlink()
        return True
    return False
