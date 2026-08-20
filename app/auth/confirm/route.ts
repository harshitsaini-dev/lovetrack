import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Handles email confirmation and password-recovery links.
 *
 * Supabase sends the user here with a one-time `token_hash`; we exchange it
 * for a session and then redirect. `next` is validated to be a relative path
 * so the link cannot be used as an open redirect.
 */

function safeNext(raw: string | null): string {
  if (!raw) return "/app/dashboard";
  // Reject absolute URLs and protocol-relative paths.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/app/dashboard";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Link galat ya adhoora hai")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Link expire ho gaya ya pehle use ho chuka hai",
      )}`,
    );
  }

  // A recovery link must land on the password form, not the dashboard.
  const destination = type === "recovery" ? "/reset-password" : next;
  return NextResponse.redirect(`${origin}${destination}`);
}
