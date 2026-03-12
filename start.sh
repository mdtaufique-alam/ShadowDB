#!/bin/bash

# ShadowDB Launcher — Scale-Ready Version
# Usage: ./start.sh [WATCH_PATH]

WATCH_PATH=${1:-"../test-docs"}

echo "🚀 Launching ShadowDB..."
echo "📂 Target Watch Directory: $WATCH_PATH"

# 1. Kill any existing servers on port 3000
lsof -ti :3000 | xargs kill -9 2>/dev/null

# 2. Start Next.js in the background
cd web
npm run dev &
NEXT_PID=$!

# 3. Wait for Next.js to be ready
echo "⏳ Waiting for Dashboard to wake up..."
until curl -s http://localhost:3000 > /dev/null; do
  sleep 2
done
echo "✅ Dashboard is live at http://localhost:3000"

# 4. Start Rust Watcher in the foreground with the specified path
echo "🦀 Starting Rust File Watcher..."
cd ../watcher
WATCH_PATH=$WATCH_PATH cargo run

# Cleanup on exit
trap "kill $NEXT_PID" EXIT
