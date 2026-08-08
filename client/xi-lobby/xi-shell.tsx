"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import XiGameHost from "./game-host.tsx";
import { disposeGameLifecycle, markXiPerf } from "./game-lifecycle.ts";
import XiLayerKeepAlive from "./layer-keepalive.tsx";
import {
  prefetchXiRoutes,
  registerXiNavigator,
  resolveXiLayer,
  setOptimisticXiLayer,
} from "./nav.ts";
import { prefetchXiNavAssets } from "./quality.ts";
import { hydrateXiUiStore } from "./ui-store.ts";
import "./lobby.css";
import "./theme-red-gold.css";

/**
 * Persistent Xi layout shell — stays mounted across Lobby/Hub/Play.
 * Registers soft Next.js navigation + post-hydrate UI store sync.
 * Hosts singleton GameClient for Hub↔Play suspend/resume (no layout pathname key).
 */
export default function XiShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    hydrateXiUiStore();
  }, []);

  useEffect(() => {
    registerXiNavigator({
      push: (href) => {
        void router.push(href);
      },
      replace: (href) => {
        void router.replace(href);
      },
      prefetch: (href) => {
        void router.prefetch(href);
      },
    });
    (window as unknown as { __xiNavReady?: boolean }).__xiNavReady = true;
    prefetchXiRoutes();
    prefetchXiNavAssets();
    return () => {
      (window as unknown as { __xiNavReady?: boolean }).__xiNavReady = false;
      registerXiNavigator(null);
    };
  }, [router]);

  // Full dispose only when leaving the Xi layout segment (not on router identity churn)
  useEffect(() => {
    return () => {
      disposeGameLifecycle();
    };
  }, []);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    document.documentElement.classList.remove("xi-nav-busy", "xi-nav-pending");
    const layer = resolveXiLayer(pathname);
    // Pathname caught up — clear optimistic layer
    setOptimisticXiLayer(null);
    markXiPerf("transitionEnd", layer ?? "unknown");
    // Resume/suspend owned by XiGameHost lifecycle — keep event for legacy listeners
    if (layer === "play") {
      window.dispatchEvent(new CustomEvent("xi-game-resume"));
    }
  }, [pathname]);

  return (
    <div className="xi-shell" data-testid="xi-shell" data-xi-path={pathname ?? ""}>
      <XiGameHost />
      <XiLayerKeepAlive>{children}</XiLayerKeepAlive>
    </div>
  );
}
