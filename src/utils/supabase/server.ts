import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Create a Supabase client for server components and API routes.
 * Uses cookie-based auth for SSR.
 */
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
};

/**
 * Create a Supabase admin client that bypasses RLS.
 * Uses the service role key if available, otherwise falls back to anon key.
 * Only use this in API routes where elevated access is needed.
 */
export const createAdminClient = () => {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createSupabaseClient(supabaseUrl!, key!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
