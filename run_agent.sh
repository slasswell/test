#!/bin/bash
# Usage: ./run_agent.sh --module [daily|weekly|monthly|all]

MODULE="all"
TIMESTAMP=$(date +"%Y-%m-%dT%H:%M:%S")
LOG_FILE="./logs/agent.log"

while [[ $# -gt 0 ]]; do
  case $1 in
    --module) MODULE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p ./logs

echo "[$TIMESTAMP] Agent run started — module: $MODULE" >> "$LOG_FILE"

# Load environment variables
if [ -f ~/.agent_env ]; then
  source ~/.agent_env
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "[$TIMESTAMP] ERROR: ANTHROPIC_API_KEY not set. Add it to ~/.agent_env" >> "$LOG_FILE"
  exit 1
fi

START_TIME=$(date +%s)

claude --dangerously-skip-permissions \
  --model claude-sonnet-4-6 \
  -p "$(cat AGENT_CLAUDE.md)

---
CURRENT RUN CONTEXT:
Timestamp: $TIMESTAMP
Module: $MODULE
Project directory: $(pwd)

Task: Execute the $MODULE scheduled tasks defined in your operating model above.
- Read all relevant state from ./agent-state/ before acting.
- Write all draft outputs to the appropriate queue files in ./agent-state/.
- Append a run summary entry to ./agent-state/run-log.json before exiting.
- Do not produce output that isn't written to a file — the log is the record." \
  >> "$LOG_FILE" 2>&1

EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
COMPLETED_AT=$(date +"%Y-%m-%dT%H:%M:%S")

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$COMPLETED_AT] Agent run completed (${DURATION}s) — module: $MODULE" >> "$LOG_FILE"
else
  echo "[$COMPLETED_AT] Agent run FAILED (exit: $EXIT_CODE, ${DURATION}s) — module: $MODULE" >> "$LOG_FILE"
fi

exit $EXIT_CODE
