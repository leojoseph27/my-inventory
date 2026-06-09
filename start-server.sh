#!/bin/bash
cd /home/z/my-project

# Start the server in a new process group, fully detached
setsid node node_modules/.bin/next start -p 3000 >> /tmp/nextjs-prod.log 2>> /tmp/nextjs-prod-err.log &
PID=$!
echo "Started Next.js with PID $PID"

# Write PID file
echo "$PID" > /tmp/nextjs.pid

# Wait a moment and verify
sleep 3
if kill -0 "$PID" 2>/dev/null; then
  echo "Server is running (PID: $PID)"
else
  echo "ERROR: Server failed to start"
fi
