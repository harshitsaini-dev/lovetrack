"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { AuthFormState } from "@/lib/auth/actions";

/**
 * Re-fetches the current route once a server action reports success.
 *
 * `revalidatePath` inside the action invalidates the server cache, but these
 * pages are dynamic (they read cookies), so there is no cached entry to
 * invalidate and the already-rendered client tree keeps showing stale data.
 * Asking the router to refresh pulls a fresh RSC payload, which is what
 * makes a newly created pair actually appear in the list.
 */
export function useRefreshOnSuccess(state: AuthFormState) {
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);
}
