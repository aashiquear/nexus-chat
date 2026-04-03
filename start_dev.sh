#!/usr/bin/env bash
# ============================================================
# Nexus Chat - Local Development Startup
# ============================================================
# Usage: bash start_dev.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════╗"
echo "║         Nexus Chat - Dev Mode        ║"
echo "╚══════════════════════════════════════╝"

# --- Check for .env ---
if [ ! -f .env ]; then
    echo "⚠  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "   → Edit .env to add your API keys, then re-run."
    exit 1
fi

# --- Backend setup ---
echo ""
echo "▸ Setting up Python environment..."

if [ ! -d .venv ]; then
    python3 -m venv .venv
    echo "  Created virtual environment"
fi

source .venv/bin/activate
pip install -q -r requirements.txt

# --- Frontend setup ---
echo ""
echo "▸ Setting up frontend..."

cd frontend
if [ ! -d node_modules ]; then
    npm install
fi

# Build frontend for serving by backend
echo "  Building frontend..."
npm run build
cd ..

# --- Start ---
echo ""
echo "▸ Starting Nexus Chat..."
echo "  → http://localhost:8000"
echo ""

python -m backend.main
