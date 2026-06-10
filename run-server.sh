#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js..." >> /tmp/nextjs-watchdog.log
  npx next start -p 3000 >> /tmp/nextjs.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE" >> /tmp/nextjs-watchdog.log
  sleep 2
done
