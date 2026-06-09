---
Task ID: 2
Agent: Super Z (Main)
Task: Migrate application from SQLite/Prisma to Supabase

Work Log:
- Installed @supabase/supabase-js and @supabase/ssr
- Added .env.local with Supabase credentials
- Created Supabase client helpers:
  - src/utils/supabase/server.ts (createClient + createAdminClient)
  - src/utils/supabase/client.ts (browser client)
  - src/utils/supabase/middleware.ts (session refresh)
  - src/utils/supabase/mappers.ts (camelCase ↔ snake_case field mapping)
- Created Next.js middleware.ts for session refresh
- Rewrote ALL 12 API routes to use Supabase instead of Prisma:
  - products/route.ts (GET list + POST create)
  - products/[id]/route.ts (GET + PUT + DELETE)
  - products/stats/route.ts (dashboard statistics)
  - products/check-duplicate/route.ts (ND Number + Barcode checking)
  - products/import/route.ts (Excel import with case-insensitive column mapping)
  - products/export/route.ts (Excel export)
  - products/cleanup/route.ts (ghost product cleanup)
  - images/upload/route.ts (Supabase Storage upload)
  - images/[id]/route.ts (DELETE + PATCH with Supabase Storage)
  - auth/login/route.ts (Supabase query)
  - auth/check/route.ts (Supabase query)
  - seed/route.ts (admin account creation)
- Replaced local file storage with Supabase Storage (product-images bucket)
- Updated Caddyfile (removed /upload/* handler)
- Updated next.config.ts (added Supabase image domain)
- Created setup API endpoint (/api/setup)
- Created supabase-setup.sql for user to run in Supabase SQL Editor
- Updated auth screen to handle missing admin_users table gracefully
- All field mapping done via mappers.ts (snake_case in DB ↔ camelCase in API)
- Frontend components unchanged (API returns same camelCase shape)

Stage Summary:
- Complete migration from Prisma/SQLite to Supabase
- User needs to run supabase-setup.sql in Supabase Dashboard to:
  1. Create admin_users table
  2. Create product-images storage bucket
  3. Set up RLS policies for all tables
- User may also need to provide SUPABASE_SERVICE_ROLE_KEY for RLS bypass
- Frontend works unchanged thanks to mapper layer
