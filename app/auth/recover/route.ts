import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Repairs a signed-in user who has no `profiles` row.
 *
 * This happens if the signup trigger did not run — e.g. the account was
 * created before migration 0001 was applied. Without this route the app
 * would bounce between /app/dashboard and /login forever, because
 * middleware sends authenticated users away from /login while the app
 * layout sends profile-less users back to it.
 *
 * A Route Handler is used because it may write cookies; a Server Component
 * may not, so it cannot sign anyone out.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Recreate the missing row with the service-role client, which is the
  // only way in: `profiles` has no INSERT policy by design.
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string | undefined)?.trim() || null,
  });

  if (!error) {
    return NextResponse.redirect(`${origin}/app/dashboard`);
  }

  // Could not repair — end the session so the user is not stuck in a loop.
  await supabase.auth.signOut();

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Profile setup adhoora hai. Dobara login karein ya admin se sampark karein.",
    )}`,
  );
}
