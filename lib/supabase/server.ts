import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Respects RLS — this is what almost all server code should use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Admin client — BYPASSES ROW LEVEL SECURITY.
 *
 * Only for trusted server-side work that genuinely cannot go through RLS
 * (cron jobs, admin actions that are separately authorized, webhooks).
 * Never expose the resulting client or its data to an unauthorized caller,
 * and never import this module from a Client Component.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // The admin client is stateless — it must never adopt a user session.
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
