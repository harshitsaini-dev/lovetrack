"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Only in production: in development it would sit in front of Turbopack's
 * HMR requests and serve stale pages, which looks exactly like a bug in
 * whatever you were just editing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Blocked, unsupported, or an insecure origin. The app works
        // without it; only the offline screen is lost.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
