#!/bin/bash

set -euo pipefail

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log_step() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [dev.sh] $*"
}

cd "$PROJECT_DIR"

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
