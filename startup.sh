#!/bin/sh
# Platform revive entrypoint — must stay idempotent and non-blocking.
set -eu
cd /workspace

LOG=/tmp/app-startup.log
PORT=8080
HEALTH="http://127.0.0.1:${PORT}/"

is_up() {
  curl -sf -o /dev/null --max-time 3 "$HEALTH"
}

if is_up; then
  exit 0
fi

# If something is half-bound but not answering, clear and restart
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  sleep 0.3
fi

# Bound on all interfaces so the live-preview proxy can reach us
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) starting vite on 0.0.0.0:${PORT}" >>"$LOG"
nohup npm run dev >>"$LOG" 2>&1 &

i=0
while [ "$i" -lt 50 ]; do
  if is_up; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ready" >>"$LOG"
    exit 0
  fi
  i=$((i + 1))
  sleep 0.4
done

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) FAILED to become ready" >>"$LOG"
exit 1
