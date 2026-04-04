# MCP Database Server

A minimal MCP-compatible server that exposes SQLite database operations as tools. Use this as a reference for building your own MCP servers.

## Tools

| Tool | Description |
|------|-------------|
| `query` | Run a read-only SQL query (SELECT) |
| `execute` | Run a write SQL statement (INSERT/UPDATE/DELETE) |
| `list_tables` | List all tables in the database |
| `describe_table` | Describe columns of a specific table |

## Running Standalone

```bash
docker build -t mcp-database .
docker run -p 8100:8100 -v mcp-db-data:/data mcp-database
```

## Running with Nexus Chat

Enable the MCP database server in `docker-compose.yml`:

```bash
docker compose --profile mcp up --build
```

Then set `mcp_servers.database.enabled: true` in `config/settings.yaml` and restart Nexus Chat.

## Protocol

The server implements a JSON-RPC 2.0 endpoint at `POST /rpc`:

```bash
# Initialize
curl -X POST http://localhost:8100/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:8100/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://localhost:8100/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tables","arguments":{}}}'
```
