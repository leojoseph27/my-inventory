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
# The while loop ensures the server comes back if it crashes.
# This script runs as a long-lived process under the container's init (tini).
log_step "Starting Next.js production server on port 3000 with auto-restart..."

RESTART_DELAY=3

while true; do
  log_step "Starting next start..."
  node node_modules/.bin/next start -p 3000 2>&1
  EXIT_CODE=$?
  log_step "Next.js exited with code $EXIT_CODE, restarting in ${RESTART_DELAY}s..."
  sleep "$RESTART_DELAY"
done
