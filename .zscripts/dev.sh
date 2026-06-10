#!/bin/bash

set -euo pipefail

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log_step() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [dev.sh] $*"
}

cd "$PROJECT_DIR"

# --- Step 0: Ensure .env.local exists with required Supabase and admin credentials ---
# The container may restart and lose .env.local, so we always ensure it exists.
# These values are safe to keep in the project .env.local (not committed to git).
if [ ! -f .env.local ] || ! grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
  log_step "Writing .env.local with Supabase credentials and admin auth..."
  cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://nqhzvhnhphpljnuerqfh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaHp2aG5ocGhwbGpudWVycWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTY5MjEsImV4cCI6MjA5NjU3MjkyMX0.L0522u5VK0fhdPdYh68pmGzf7y84OrUZonVYX5UYVp0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaHp2aG5ocGhwbGpudWVycWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk5NjkyMSwiZXhwIjoyMDk2NTcyOTIxfQ.oevoQmoFxG8gQnrZpNK5XSyUWhO6Nmv5w-nqOMcuovE
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=ChangeMe123
ENVEOF
  log_step ".env.local written successfully"
else
  log_step ".env.local already exists with Supabase credentials"
fi

# --- Step 1: Install dependencies ---
log_step "Installing dependencies..."
bun install 2>&1

# --- Step 2: Database (no-op for Supabase) ---
log_step "Running db:push (no-op for Supabase)..."
bun run db:push 2>&1 || true

# --- Step 3: Build production bundle ---
log_step "Building Next.js production bundle..."
NODE_OPTIONS="--max-old-space-size=768" node node_modules/.bin/next build 2>&1

# --- Step 4: Start Next.js production server with auto-restart ---
# Production mode (next start) is more stable and uses less memory than dev mode.
# Uses double-fork daemon pattern so the server persists even if the parent
# shell session (started by /start.sh) is killed or reparented.
log_step "Starting Next.js production server on port 3000 (double-fork daemon)..."

LOGFILE=/tmp/nextjs-daemon.log
PIDFILE=/tmp/nextjs-daemon.pid
RESTART_DELAY=3

# Kill any previous daemon instance
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log_step "Killing previous daemon (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDFILE"
fi

# Double-fork daemon: ensures the process is fully detached from any terminal
(
  (
    echo $$ > "$PIDFILE"
    while true; do
      echo "[$(date)] Starting Next.js production server..." >> "$LOGFILE"
      node "$PROJECT_DIR/node_modules/.bin/next" start -p 3000 >> "$LOGFILE" 2>&1
      EXIT_CODE=$?
      echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in ${RESTART_DELAY}s..." >> "$LOGFILE"
      sleep "$RESTART_DELAY"
    done
  ) &
  exit 0
) &

# Wait briefly for daemon to start and verify
sleep 3
if [ -f "$PIDFILE" ]; then
  DAEMON_PID=$(cat "$PIDFILE")
  log_step "Daemon started with PID $DAEMON_PID"
else
  log_step "Warning: PID file not created, but daemon may still be starting"
fi

# Verify the server is responding
MAX_WAIT=15
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    log_step "Next.js server is responding on port 3000"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  log_step "ERROR: Next.js server did not respond within ${MAX_WAIT}s"
fi

# Keep this script alive so the container's start.sh doesn't think it's done
# and potentially clean up the daemon. The daemon runs independently, but we
# wait here to maintain the process hierarchy.
log_step "Dev script keeping alive (daemon is independent)..."
while true; do
  sleep 60
done
