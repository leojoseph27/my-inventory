import { type NextRequest, NextResponse } from "next/server";

/**
 * Lightweight middleware — no Supabase session refresh needed.
 * Auth is handled via hardcoded environment variables, not Supabase Auth.
 * This middleware simply passes all requests through.
 */
export const updateSession = async (request: NextRequest) => {
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
};
