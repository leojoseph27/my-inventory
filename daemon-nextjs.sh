#!/bin/bash
# Daemon script for Next.js - runs independently of any shell session
cd /home/z/my-project

LOGFILE=/tmp/nextjs-daemon.log

echo "[$(date)] Daemon starting..." >> "$LOGFILE"

while true; do
  echo "[$(date)] Starting Next.js production server..." >> "$LOGFILE"
  node node_modules/.bin/next start -p 3000 >> "$LOGFILE" 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 3s..." >> "$LOGFILE"
  sleep 3
done
