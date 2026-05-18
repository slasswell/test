#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Bridgeworks Agent Infrastructure..."
echo ""

# Load env if available
if [ -f ~/.agent_env ]; then
  source ~/.agent_env
fi

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/dashboard/node_modules" ]; then
  echo "Installing dashboard dependencies..."
  cd "$SCRIPT_DIR/dashboard" && npm install --silent
fi

if [ ! -d "$SCRIPT_DIR/executor/node_modules" ]; then
  echo "Installing executor dependencies..."
  cd "$SCRIPT_DIR/executor" && npm install --silent
fi

cd "$SCRIPT_DIR"

# Start dashboard
echo "Starting dashboard on http://localhost:${DASHBOARD_PORT:-3333}..."
node dashboard/server.js &
DASHBOARD_PID=$!

# Start executor
echo "Starting executor..."
node executor/executor.js &
EXECUTOR_PID=$!

echo "$DASHBOARD_PID" > .dashboard.pid
echo "$EXECUTOR_PID" > .executor.pid

echo ""
echo "Dashboard: http://localhost:${DASHBOARD_PORT:-3333}"
echo "Dashboard PID: $DASHBOARD_PID"
echo "Executor PID:  $EXECUTOR_PID"
echo ""
echo "Press Ctrl+C to stop, or run ./stop.sh from another terminal."

trap './stop.sh' INT TERM

wait
