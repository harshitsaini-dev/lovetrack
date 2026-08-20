import type { Metadata } from "next";

import { OfflineScreen } from "@/components/layout/offline-screen";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no network.
 *
 * NOT force-static, despite being cached ahead of time. A statically
 * prerendered page carries a build-time CSP nonce, which cannot match the
 * per-request one — so it was the only page still throwing a CSP
 * violation. The service worker caches whatever the response is at install
 * time, so rendering it per-request costs nothing here.
 */
export default function OfflinePage() {
  return <OfflineScreen />;
}
