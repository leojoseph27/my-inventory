#!/bin/bash
# Persistent Next.js server with auto-restart
cd /home/z/my-project

while true; do
  echo "[$(date)] Starting Next.js production server..." >> /tmp/nextjs-err.log
  node node_modules/.bin/next start -p 3000 >> /tmp/nextjs-prod.log 2>> /tmp/nextjs-err.log
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 3s..." >> /tmp/nextjs-err.log
  sleep 3
done
