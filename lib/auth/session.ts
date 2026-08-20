import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Server-side session + profile helpers.
 *
 * Always use getUser() (never getSession()) on the server — getSession()
 * trusts the cookie without verifying it against Supabase.
 */

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data ?? null;
}

/** Requires a signed-in, non-suspended user. Redirects otherwise. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Authenticated but no profile row — send them to the repair route.
  // Redirecting to /login here would loop, because middleware bounces
  // authenticated users straight back to the dashboard.
  if (!profile) {
    redirect("/auth/recover");
  }

  if (profile.status === "suspended") {
    redirect("/suspended");
  }

  return profile;
}

/**
 * Requires an admin. This is the server-side authorization gate —
 * it is enforced again by RLS at the database level.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/app/dashboard");
  }

  return profile;
}
