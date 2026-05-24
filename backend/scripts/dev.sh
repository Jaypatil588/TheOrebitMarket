#!/usr/bin/env sh
# Prepare and run backend dev server from project root.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

lsof -ti :8080 2>/dev/null | xargs kill -TERM 2>/dev/null || true
pkill -TERM -f '[o]rebit-backend' 2>/dev/null || true

echo "Backend port 8080 cleared, starting server..."
exec go run ./backend/main.go
