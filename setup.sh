#!/bin/bash
# setup.sh — one-command setup for Bridgeworks Agent on this Mac
# Run once after cloning the repo. Safe to re-run.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERNAME="$(whoami)"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
PLIST_DIR="$PROJECT_DIR/launchd"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Bridgeworks Agent — macOS Setup                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Project directory : $PROJECT_DIR"
echo "Username          : $USERNAME"
echo ""

# ── Detect homebrew prefix ──────────────────────────────────────────
if [ -d "/opt/homebrew/bin" ]; then
  BREW_PREFIX="/opt/homebrew"
else
  BREW_PREFIX="/usr/local"
fi
echo "Homebrew prefix   : $BREW_PREFIX"

# ── Detect node ─────────────────────────────────────────────────────
NODE_PATH="$(which node 2>/dev/null || echo "$BREW_PREFIX/bin/node")"
echo "Node.js           : $NODE_PATH"

# ── Detect claude CLI ────────────────────────────────────────────────
CLAUDE_PATH="$(which claude 2>/dev/null || echo "")"
if [ -z "$CLAUDE_PATH" ]; then
  echo ""
  echo "⚠  'claude' CLI not found in PATH."
  echo "   Install it: npm install -g @anthropic-ai/claude-code"
  echo "   Then re-run setup.sh."
  exit 1
fi
echo "Claude CLI        : $CLAUDE_PATH"
echo ""

# ── Install npm dependencies ─────────────────────────────────────────
echo "Installing dashboard dependencies..."
cd "$PROJECT_DIR/dashboard" && npm install --silent
echo "Installing executor dependencies..."
cd "$PROJECT_DIR/executor" && npm install --silent
cd "$PROJECT_DIR"
echo ""

# ── Patch all plists ─────────────────────────────────────────────────
echo "Patching launchd plists..."

SED_EXPRS=(
  "s|/path/to/project|$PROJECT_DIR|g"
  "s|/Users/YOURUSERNAME|$HOME|g"
  "s|YOURUSERNAME|$USERNAME|g"
  "s|/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/sbin|/usr/local/bin:/usr/bin:/bin:$BREW_PREFIX/bin:$BREW_PREFIX/sbin:$(dirname "$NODE_PATH")|g"
)

for plist in "$PLIST_DIR"/*.plist; do
  for expr in "${SED_EXPRS[@]}"; do
    sed -i '' "$expr" "$plist"
  done
  echo "  Patched: $(basename "$plist")"
done
echo ""

# ── Install plists to LaunchAgents ───────────────────────────────────
echo "Installing plists to ~/Library/LaunchAgents/..."
mkdir -p "$LAUNCHD_DIR"

PLISTS=(
  "com.consultingagent.daily.plist"
  "com.consultingagent.weekly.plist"
  "com.consultingagent.monthly.plist"
  "com.consultingagent.dashboard.plist"
  "com.consultingagent.executor.plist"
)

for plist in "${PLISTS[@]}"; do
  src="$PLIST_DIR/$plist"
  dst="$LAUNCHD_DIR/$plist"
  cp "$src" "$dst"
  # Unload first in case it was loaded before
  launchctl unload "$dst" 2>/dev/null || true
  launchctl load "$dst"
  echo "  Loaded: $plist"
done
echo ""

# ── Create ~/.agent_env if missing ───────────────────────────────────
AGENT_ENV="$HOME/.agent_env"
if [ ! -f "$AGENT_ENV" ]; then
  echo "Creating ~/.agent_env template..."
  cat > "$AGENT_ENV" << ENVEOF
# Bridgeworks Agent — Environment Variables
# Fill in your API keys. This file is never committed to git.

export ANTHROPIC_API_KEY="sk-ant-REPLACE_ME"
export GMAIL_CLIENT_ID=""
export GMAIL_CLIENT_SECRET=""
export GMAIL_REFRESH_TOKEN=""
export AGENT_PROJECT_DIR="$PROJECT_DIR"
export DASHBOARD_PORT=3333
ENVEOF
  chmod 600 "$AGENT_ENV"
  echo "  Created: $AGENT_ENV"
  echo "  ⚠  Add your ANTHROPIC_API_KEY before the agent will run."
else
  echo "~/.agent_env already exists — skipping."
fi
echo ""

# ── Create logs dir ───────────────────────────────────────────────────
mkdir -p "$PROJECT_DIR/logs"

# ── Make scripts executable ───────────────────────────────────────────
chmod +x "$PROJECT_DIR/run_agent.sh" "$PROJECT_DIR/start.sh" "$PROJECT_DIR/stop.sh"

# ── Summary ───────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup complete.                                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Next steps:                                             ║"
echo "║  1. Add ANTHROPIC_API_KEY to ~/.agent_env               ║"
echo "║  2. Add Gmail OAuth credentials to ~/.agent_env         ║"
echo "║     (see README for OAuth setup steps)                  ║"
echo "║  3. Open http://localhost:3333 — dashboard is running   ║"
echo "║                                                          ║"
echo "║  Schedule:                                               ║"
echo "║  · Daily agent  → weekdays 7:00 AM                      ║"
echo "║  · Weekly agent → Mondays 7:30 AM                       ║"
echo "║  · Monthly agent→ 1st of month 8:00 AM                  ║"
echo "║  · Dashboard + Executor → always on, auto-restart       ║"
echo "║                                                          ║"
echo "║  Manual trigger: http://localhost:3333 → Settings       ║"
echo "╚══════════════════════════════════════════════════════════╝"
