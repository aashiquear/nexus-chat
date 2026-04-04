# MCP Database Server

A minimal MCP-compatible server that exposes SQLite database operations as tools. Use this as a reference for building your own MCP servers.

## Tools

| Tool | Description |
|------|-------------|
| `query` | Run a read-only SQL query (SELECT) |
| `execute` | Run a write SQL statement (INSERT/UPDATE/DELETE) |
| `list_tables` | List all tables in the database |
| `describe_table` | Describe columns of a specific table |

## Running with Nexus Chat (bundled)

From the **repo root**, start both services together:

```bash
docker compose --profile mcp up --build
```

Both containers share the `nexus-net` network automatically.

## Running Standalone

If you want to run this server independently (e.g. it's already deployed, or you manage it separately), join the same Docker network that Nexus Chat uses:

```bash
# 1. Create the shared network (skip if Nexus Chat already created it)
docker network create nexus-net

# 2. Start the MCP database server
cd examples/mcp-database-server
docker compose up --build

# 3. Start Nexus Chat (from repo root, in another terminal)
docker compose up --build
```

Because both containers are on `nexus-net`, Nexus Chat can reach the server at `http://mcp-database:8100` — the same URL used in `settings.yaml`.

### Without Docker Compose

You can also use plain `docker run`:

```bash
docker build -t mcp-database .
docker run --name mcp-database --network nexus-net -p 8100:8100 -v mcp-db-data:/data mcp-database
```

## Configuration in Nexus Chat

In `config/settings.yaml`, enable the database server:

```yaml
mcp_servers:
  database:
    enabled: true
    name: "Database"
    description: "Query and manage a SQLite database"
    url: "http://mcp-database:8100"
    icon: "database"
    timeout: 30
```

Restart Nexus Chat — the database tools appear in the sidebar.

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
