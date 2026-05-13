#!/bin/bash
# Wrapper called by launchd — loads env then starts the dashboard server.
# launchd does not source ~/.bashrc or ~/.zshrc, so env must be loaded explicitly.

source "$HOME/.agent_env" 2>/dev/null || true

cd "$(dirname "$0")/.."
exec node dashboard/server.js
