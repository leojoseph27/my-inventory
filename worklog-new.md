---
Task ID: 1
Agent: Main Agent
Task: Diagnose and fix 502 errors, Excel import, product card display

Work Log:
- Diagnosed 502 errors: Next.js server was not running (no process on port 3000)
- Root cause: Server process died between Bash tool invocations; needed persistent process management
- Solution: Created keep-nextjs-alive.sh watchdog script with auto-restart loop using setsid for detachment
- Updated dev.sh to use production mode (next build + next start) with auto-restart while loop
- Verified all API endpoints return 200 through both localhost:3000 and Caddy reverse proxy (port 81)
- Verified no Prisma/admin_users/SQLite references remain
- Excel import already properly implemented with full column mapping and partial-row support
- Fixed product card display: fallback chain englishDescription -> ndNumber -> Item #sr -> Unnamed Product

Stage Summary:
- Server running persistently via watchdog script on port 3000
- All endpoints verified working
- Excel import handles all row types including partial rows
- Product cards show english_description with smart fallback
