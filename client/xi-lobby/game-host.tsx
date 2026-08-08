"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import GameClient from "../../app/game-client.tsx";
import {
  activateGameLifecycle,
  getGameLifecycleState,
  registerGameHostController,
  suspendGameLifecycle,
  subscribeGameLifecycle,
} from "./game-lifecycle.ts";
import {
  getOptimisticXiLayer,
  resolveEffectiveXiLayer,
  subscribeOptimisticXiLayer,
} from "./nav.ts";
import {
  getLobbyLangServerSnapshot,
  loadLobbyLang,
  subscribeLobbyLang,
  tLobby,
} from "./i18n.ts";
import { activeTierFromSettings } from "./quality.ts";
import {
  getXiHydratedServerSnapshot,
  getXiHydratedSnapshot,
  getXiQualityServerSnapshot,
  getXiQualitySnapshot,
  subscribeXiHydrated,
  subscribeXiQuality,
} from "./ui-store.ts";

/**
 * Persistent GameClient host under XiShell.
 * Mounts once; Hub↔Play toggles visibility + suspend/activate (no full dispose).
 * Uses optimistic layer so warm Play shows before pathname settles.
 */
export default function XiGameHost() {
  const pathname = usePathname();
  useSyncExternalStore(
    subscribeOptimisticXiLayer,
    getOptimisticXiLayer,
    () => null,
  );
  const layer = resolveEffectiveXiLayer(pathname);
  const [mounted, setMounted] = useState(false);
  const [deferBootstrap, setDeferBootstrap] = useState(true);
  const [visible, setVisible] = useState(false);

  const lifecycle = useSyncExternalStore(
    subscribeGameLifecycle,
    getGameLifecycleState,
    () => "UNINITIALIZED" as const,
  );

  const lang = useSyncExternalStore(
    subscribeLobbyLang,
    loadLobbyLang,
    getLobbyLangServerSnapshot,
  );

  const qualityHydrated = useSyncExternalStore(
    subscribeXiHydrated,
    getXiHydratedSnapshot,
    getXiHydratedServerSnapshot,
  );
  const qualitySettings = useSyncExternalStore(
    subscribeXiQuality,
    getXiQualitySnapshot,
    getXiQualityServerSnapshot,
  );

  useEffect(() => {
    registerGameHostController({
      requestMount: (opts) => {
        setDeferBootstrap(opts?.deferBootstrap !== false);
        setMounted(true);
      },
      requestUnmount: () => {
        setMounted(false);
        setVisible(false);
      },
      setVisible: (active) => {
        setVisible(active);
      },
    });
    return () => {
      registerGameHostController(null);
    };
  }, []);

  useEffect(() => {
    if (layer === "play") {
      const label = tLobby(lang, "lobby.play.loading");
      void activateGameLifecycle(label);
      return;
    }

    const st = getGameLifecycleState();
    if (st === "ACTIVE" || st === "READY" || st === "PRELOADING") {
      const tier = qualityHydrated
        ? activeTierFromSettings(qualitySettings)
        : "medium";
      suspendGameLifecycle({ releaseHeavyFx: tier === "low" });
    }
  }, [layer, lang, qualityHydrated, qualitySettings]);

  useEffect(() => {
    if (layer === "play") setVisible(true);
  }, [layer]);

  const active = layer === "play" && visible;

  useEffect(() => {
    document.documentElement.classList.toggle("xi-play-active", active);
    return () => {
      document.documentElement.classList.remove("xi-play-active");
    };
  }, [active]);

  return (
    <div
      id="xi-game-host"
      className={
        active ? "xi-game-host is-active" : "xi-game-host is-suspended"
      }
      data-testid="xi-game-host"
      data-xi-game-state={lifecycle}
      data-xi-game-mounted={mounted ? "1" : "0"}
      aria-hidden={!active}
    >
      {mounted ? (
        <GameClient key="xi-singleton-game" deferBootstrap={deferBootstrap} />
      ) : null}
    </div>
  );
}
