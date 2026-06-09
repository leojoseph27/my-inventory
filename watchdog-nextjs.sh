#!/bin/bash
# Next.js watchdog - ensures the server is always running
PIDFILE=/tmp/nextjs.pid
LOGFILE=/tmp/nextjs-prod.log
ERRFILE=/tmp/nextjs-prod-err.log

check_and_start() {
  local pid
  pid=$(cat "$PIDFILE" 2>/dev/null)
  
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # Server is running
    return 0
  fi
  
  # Server is not running - start it
  echo "[$(date)] Starting Next.js server..." >> "$ERRFILE"
  cd /home/z/my-project
  nohup node node_modules/.bin/next start -p 3000 >> "$LOGFILE" 2>> "$ERRFILE" &
  local new_pid=$!
  echo "$new_pid" > "$PIDFILE"
  echo "[$(date)] Started Next.js with PID $new_pid" >> "$ERRFILE"
}

check_and_start
