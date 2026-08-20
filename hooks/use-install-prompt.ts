"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * The install event is not in TypeScript's DOM lib yet.
 * https://developer.mozilla.org/docs/Web/API/BeforeInstallPromptEvent
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = {
  /** True when the browser has offered an install prompt we can trigger. */
  canInstall: boolean;
  /** True when the app is already running as an installed PWA. */
  isInstalled: boolean;
  /** iOS Safari never fires the event — it needs Share → Add to Home Screen. */
  isIOS: boolean;
  promptInstall: () => Promise<void>;
};

const STANDALONE_QUERY = "(display-mode: standalone)";

/**
 * Both of the checks below read from the browser, which the server cannot
 * know about. useSyncExternalStore gives them a defined server snapshot, so
 * they hydrate cleanly instead of flipping state inside an effect.
 */

function subscribeToDisplayMode(onChange: () => void) {
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);

  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getIsInstalled(): boolean {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    // iOS Safari exposes this instead of the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/** User agent never changes during a session, so there is nothing to subscribe to. */
const noopSubscribe = () => () => {};

function getIsIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent)
  );
}

/**
 * Wraps the `beforeinstallprompt` flow.
 *
 * Chrome fires the event once and expects us to stash it and call `prompt()`
 * from a user gesture later. It never fires on iOS, or when the app is
 * already installed — the returned flags let the UI say the right thing in
 * each of those cases instead of showing a button that does nothing.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  const isInstalled = useSyncExternalStore(
    subscribeToDisplayMode,
    getIsInstalled,
    () => false,
  );

  const isIOS = useSyncExternalStore(noopSubscribe, getIsIOS, () => false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Stop Chrome's own mini-infobar so our button is the single entry point.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;

    await deferred.prompt();
    await deferred.userChoice;

    // The event is single-use; Chrome fires a fresh one if still eligible.
    setDeferred(null);
  }, [deferred]);

  return {
    canInstall: deferred !== null && !isInstalled,
    isInstalled,
    isIOS,
    promptInstall,
  };
}
