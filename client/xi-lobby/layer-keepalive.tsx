"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import BdkHub from "./bdk-hub.tsx";
import BdkPlayShell from "./play-shell.tsx";
import {
  getGameLifecycleState,
  subscribeGameLifecycle,
} from "./game-lifecycle.ts";
import {
  getOptimisticXiLayer,
  resolveEffectiveXiLayer,
  resolveXiLayer,
  subscribeOptimisticXiLayer,
} from "./nav.ts";

/**
 * Keep Hub + Play chrome mounted after first visit so warm Hub↔Play
 * does not wait on RSC remount. Uses optimistic layer for instant switch.
 * Pre-arms Play chrome when GameClient reaches READY on Hub (hover/idle warm).
 */
export default function XiLayerKeepAlive({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const optimistic = useSyncExternalStore(
    subscribeOptimisticXiLayer,
    getOptimisticXiLayer,
    () => null,
  );
  const lifecycle = useSyncExternalStore(
    subscribeGameLifecycle,
    getGameLifecycleState,
    () => "UNINITIALIZED" as const,
  );
  const layer = resolveEffectiveXiLayer(pathname) ?? resolveXiLayer(pathname);
  const hubVisited = useRef(false);
  const playVisited = useRef(false);
  const [hubAlive, setHubAlive] = useState(false);
  const [playAlive, setPlayAlive] = useState(false);

  useEffect(() => {
    const real = resolveXiLayer(pathname);
    if (real !== "hub" && hubVisited.current) setHubAlive(true);
    if (real !== "play" && playVisited.current) setPlayAlive(true);
    if (real === "hub") hubVisited.current = true;
    if (real === "play") playVisited.current = true;
  }, [pathname]);

  useEffect(() => {
    if (!optimistic) return;
    if (optimistic !== "hub" && hubVisited.current) setHubAlive(true);
    if (optimistic !== "play" && playVisited.current) setPlayAlive(true);
    // Entering play optimistically — ensure play chrome exists
    if (optimistic === "play") setPlayAlive(true);
    if (optimistic === "hub") setHubAlive(true);
  }, [optimistic]);

  // Hub idle/warm READY → pre-mount Play chrome (hidden) so first Start has ← back
  useEffect(() => {
    const real = resolveXiLayer(pathname);
    if (
      (real === "hub" || optimistic === "hub" || !optimistic) &&
      (lifecycle === "READY" || lifecycle === "SUSPENDED" || lifecycle === "ACTIVE")
    ) {
      setPlayAlive(true);
    }
  }, [lifecycle, pathname, optimistic]);

  const useHubCache = layer === "hub" && hubAlive;
  const usePlayCache = layer === "play" && playAlive;
  // While optimistically on play, suppress hub RSC even if hubAlive not set yet
  const suppressRsc =
    useHubCache || usePlayCache || (layer === "play" && playAlive);

  return (
    <>
      {hubAlive ? (
        <div
          className={
            layer === "hub"
              ? "xi-layer-keep is-active"
              : "xi-layer-keep is-hidden"
          }
          data-testid="xi-hub-keepalive"
          aria-hidden={layer !== "hub"}
        >
          <BdkHub />
        </div>
      ) : null}

      {playAlive ? (
        <div
          className={
            layer === "play"
              ? "xi-layer-keep is-active"
              : "xi-layer-keep is-hidden"
          }
          data-testid="xi-play-keepalive"
          aria-hidden={layer !== "play"}
        >
          <BdkPlayShell />
        </div>
      ) : null}

      <div
        className={
          suppressRsc ? "xi-layer-rsc is-suppressed" : "xi-layer-rsc"
        }
        aria-hidden={suppressRsc}
      >
        {suppressRsc ? null : children}
      </div>
    </>
  );
}
