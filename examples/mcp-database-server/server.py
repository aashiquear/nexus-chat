"""
Example MCP Database Server
============================
A lightweight MCP-compatible server that exposes SQLite operations as tools.

Endpoints:
  POST /rpc     — JSON-RPC 2.0 (initialize, tools/list, tools/call)
  GET  /health  — liveness probe

Tools provided:
  - query       : Run a read-only SQL query (SELECT)
  - execute     : Run a write SQL statement (INSERT/UPDATE/DELETE)
  - list_tables : List all tables in the database
  - describe    : Describe columns of a table

The database file is stored at /data/database.db (mounted volume).
A sample "notes" table is created on first boot.
"""

import json
import logging
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-database")

DB_PATH = Path("/data/database.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MCP Database Server")

# ── Bootstrap ────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _bootstrap():
    """Create sample tables on first run."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT    NOT NULL,
            body  TEXT    DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Seed a couple of rows if table is empty
    count = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
    if count == 0:
        conn.execute("INSERT INTO notes (title, body) VALUES (?, ?)",
                      ("Welcome", "This is a sample note from the MCP database server."))
        conn.execute("INSERT INTO notes (title, body) VALUES (?, ?)",
                      ("Setup", "Connect Nexus Chat to this server to query your data."))
    conn.commit()
    conn.close()
    logger.info("Database bootstrapped at %s", DB_PATH)


_bootstrap()

# ── Tool definitions ─────────────────────────────────────────────────

TOOLS = [
    {
        "name": "query",
        "description": "Run a read-only SQL query (SELECT) and return the results as JSON.",
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "A SELECT SQL statement to execute."
                }
            },
            "required": ["sql"],
        },
    },
    {
        "name": "execute",
        "description": "Run a write SQL statement (INSERT, UPDATE, DELETE) and return the number of affected rows.",
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "A write SQL statement (INSERT/UPDATE/DELETE)."
                }
            },
            "required": ["sql"],
        },
    },
    {
        "name": "list_tables",
        "description": "List all tables in the SQLite database.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "describe_table",
        "description": "Describe the columns of a specific table.",
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "The name of the table to describe."
                }
            },
            "required": ["table"],
        },
    },
]

# ── Tool execution ───────────────────────────────────────────────────

def _exec_query(sql: str) -> dict:
    sql_stripped = sql.strip().upper()
    if not sql_stripped.startswith("SELECT"):
        return {"error": "Only SELECT statements are allowed. Use 'execute' for writes."}
    conn = get_db()
    try:
        rows = conn.execute(sql).fetchall()
        return {"rows": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


def _exec_write(sql: str) -> dict:
    sql_stripped = sql.strip().upper()
    if sql_stripped.startswith("SELECT"):
        return {"error": "Use 'query' for SELECT statements."}
    conn = get_db()
    try:
        cur = conn.execute(sql)
        conn.commit()
        return {"affected_rows": cur.rowcount}
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
    finally:
        conn.close()


def _list_tables() -> dict:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        return {"tables": [r["name"] for r in rows]}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


def _describe_table(table: str) -> dict:
    conn = get_db()
    try:
        rows = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
        if not rows:
            return {"error": f"Table '{table}' not found."}
        columns = [
            {"name": r["name"], "type": r["type"], "notnull": bool(r["notnull"]), "pk": bool(r["pk"])}
            for r in rows
        ]
        return {"table": table, "columns": columns}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


TOOL_HANDLERS = {
    "query": lambda args: _exec_query(args["sql"]),
    "execute": lambda args: _exec_write(args["sql"]),
    "list_tables": lambda args: _list_tables(),
    "describe_table": lambda args: _describe_table(args["table"]),
}

# ── JSON-RPC endpoint ────────────────────────────────────────────────

@app.post("/rpc")
async def rpc(request: Request):
    body = await request.json()
    method = body.get("method", "")
    params = body.get("params", {})
    req_id = body.get("id", 1)

    if method == "initialize":
        return _ok(req_id, {
            "name": "mcp-database",
            "version": "0.1.0",
            "description": "SQLite database MCP server",
        })

    if method == "tools/list":
        return _ok(req_id, {"tools": TOOLS})

    if method == "tools/call":
        name = params.get("name", "")
        arguments = params.get("arguments", {})
        handler = TOOL_HANDLERS.get(name)
        if not handler:
            return _error(req_id, f"Unknown tool: {name}")
        try:
            result = handler(arguments)
            return _ok(req_id, result)
        except Exception as e:
            return _error(req_id, str(e))

    return _error(req_id, f"Unknown method: {method}")


@app.get("/health")
async def health():
    return {"status": "ok", "server": "mcp-database"}


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(req_id, result):
    return JSONResponse({"jsonrpc": "2.0", "id": req_id, "result": result})

def _error(req_id, message):
    return JSONResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": -1, "message": message}})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8100, reload=False)
