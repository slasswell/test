#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

stop_pid() {
  local name=$1
  local pidfile="$SCRIPT_DIR/.$2.pid"
  if [ -f "$pidfile" ]; then
    local pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" && echo "$name stopped (PID $pid)."
    else
      echo "$name was not running."
    fi
    rm -f "$pidfile"
  else
    echo "No PID file for $name."
  fi
}

stop_pid "Dashboard" "dashboard"
stop_pid "Executor" "executor"
