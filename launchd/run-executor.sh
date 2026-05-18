#!/bin/bash
# Wrapper called by launchd — loads env then starts the executor.

source "$HOME/.agent_env" 2>/dev/null || true

cd "$(dirname "$0")/.."
exec node executor/executor.js
