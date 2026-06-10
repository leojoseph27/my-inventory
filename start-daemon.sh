#!/bin/bash
# Double-fork daemon for Next.js
# This ensures the process is completely detached from any terminal session

cd /home/z/my-project

LOGFILE=/tmp/nextjs-daemon.log
PIDFILE=/tmp/nextjs-daemon.pid

# First fork - creates child, parent exits immediately
(
  # Second fork - creates grandchild, child exits
  (
    # Grandchild runs the actual server loop
    echo $$ > "$PIDFILE"
    
    while true; do
      echo "[$(date)] Starting Next.js production server..." >> "$LOGFILE"
      node node_modules/.bin/next start -p 3000 >> "$LOGFILE" 2>&1
      EXIT_CODE=$?
      echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 3s..." >> "$LOGFILE"
      sleep 3
    done
  ) &
  # Child exits immediately
  exit 0
) &
# Parent waits just enough for PID file to be written
sleep 2

if [ -f "$PIDFILE" ]; then
  DAEMON_PID=$(cat "$PIDFILE")
  echo "Daemon started with PID $DAEMON_PID"
else
  echo "Warning: PID file not created yet"
fi
