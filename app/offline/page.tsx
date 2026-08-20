import type { Metadata } from "next";

import { OfflineScreen } from "@/components/layout/offline-screen";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no network.
 *
 * Static on purpose: it has to be cached ahead of time, so it cannot depend
 * on anything the server would have to provide at request time.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineScreen />;
}
