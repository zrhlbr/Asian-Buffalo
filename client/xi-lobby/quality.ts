/**
 * Xi lobby/hub quality bridge — presentation only.
 * Reuses client/m5/quality settings; applies CSS tier + hero helpers.
 */
"use client";

import {
  applyDocumentTierAttrs,
  applySettingsToProfile,
  defaultQualitySettings,
  detectInitialTier,
  profileFor,
  readStoredQualitySettings,
  resolveTier,
  storeQualitySettings,
  type QualityMode,
  type QualitySettings,
  type QualityTier,
} from "../m5/quality.ts";

export type {
  QualityMode,
  QualitySettings,
  QualityTier,
} from "../m5/quality.ts";

export {
  defaultQualitySettings,
  readStoredQualitySettings,
  storeQualitySettings,
  resolveTier,
  detectInitialTier,
  profileFor,
  applySettingsToProfile,
};

const TIER_ATTR = "data-xi-tier";
const MODE_ATTR = "data-xi-quality";
const FX_ATTR = "data-xi-fx";

export type HeroKind = "journey" | "bdk";

/** Responsive hero URLs generated from existing masters (see scripts/gen-xi-hero-variants.mjs). */
export function heroSources(kind: HeroKind): {
  low: string;
  mobile: string;
  tablet: string;
  desktop: string;
  fallback: string;
} {
  if (kind === "bdk") {
    return {
      low: "/xi/heroes/bdk-low.webp",
      mobile: "/xi/heroes/bdk-mobile.webp",
      tablet: "/xi/heroes/bdk-tablet.webp",
      desktop: "/xi/heroes/bdk-desktop.webp",
      fallback: "/xi/heroes/bull-demon-king.png",
    };
  }
  return {
    low: "/xi/heroes/journey-low.webp",
    mobile: "/xi/heroes/journey-mobile.webp",
    tablet: "/xi/heroes/journey-tablet.webp",
    desktop: "/xi/heroes/journey-desktop.webp",
    fallback: "/xi/journey-hero.png",
  };
}

/** Declared widths align with P2 progressive ladder (720 / 1080 / 1440). */
export function heroSrcSet(kind: HeroKind): string {
  const s = heroSources(kind);
  return `${s.mobile} 720w, ${s.tablet} 1080w, ${s.desktop} 1440w`;
}

/** AVIF srcset parallel to WebP (same widths). */
export function heroAvifSrcSet(kind: HeroKind): string {
  return heroSrcSet(kind)
    .split(", ")
    .map((part) => part.replace(/\.webp/g, ".avif"))
    .join(", ");
}

export function heroSizes(): string {
  return "(max-width: 720px) 100vw, (max-width: 1080px) 100vw, 1440px";
}

export function activeTierFromSettings(settings?: QualitySettings): QualityTier {
  const s = settings ?? readStoredQualitySettings();
  return resolveTier(s.mode);
}

export function transitionMsForTier(tier: QualityTier): number {
  return profileFor(tier).transitionMs;
}

/** Apply document-level quality attrs for CSS degradation. */
export function applyDocumentQuality(settings?: QualitySettings): QualityTier {
  if (typeof document === "undefined") return "medium";
  const s = settings ?? readStoredQualitySettings();
  const tier = resolveTier(s.mode);
  applyDocumentTierAttrs(tier, s);
  // Keep attrs aligned with legacy names used in CSS
  document.documentElement.setAttribute(TIER_ATTR, tier);
  document.documentElement.setAttribute(MODE_ATTR, s.mode);
  document.documentElement.setAttribute(FX_ATTR, s.fxEnabled ? "on" : "off");
  return tier;
}

function prefetchHref(href: string, as?: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-xi-prefetch="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  if (as) link.as = as;
  link.href = href;
  link.setAttribute("data-xi-prefetch", href);
  document.head.appendChild(link);
}

/**
 * Quality-tiered Hub→Play preload matrix.
 * Priority 1 (core): play route, boot chunk, symbol PNGs, HUD CSS side-effect via boot.
 * Priority 2/3 (FX): deferred — buffalo fur / heavy particles stay lazy until ACTIVE.
 */
export async function prefetchPlayCoreByTier(tier?: QualityTier): Promise<void> {
  if (typeof document === "undefined") return;
  const t = tier ?? activeTierFromSettings();
  prefetchHref("/xi/bull-demon-king/play");
  prefetchHref("/game");

  // Boot + symbols module (JS chunks)
  const [{ listSymbolArtUrls, preloadSymbolArt }] = await Promise.all([
    import("../m5/game/symbols.ts"),
    import("../m5/boot.ts").catch(() => null),
  ]);

  const urls = listSymbolArtUrls();
  // LOW: core animals + wild/scatter + A/K only; MED+: full 13
  const coreIds =
    t === "low"
      ? urls.filter((u) =>
          /buffalo|lion|elephant|wild|scatter|\/a\.|\/k\./i.test(u),
        )
      : urls;
  for (const href of coreIds) prefetchHref(href, "image");

  // Decode into symbol canvas cache (no WebGL / Session)
  if (t === "low") {
    await preloadSymbolArt().catch(() => undefined);
  } else {
    await preloadSymbolArt().catch(() => undefined);
  }
}

/** Prefetch slot play route + boot chunk after Start (lazy until then). */
export function prefetchSlotAssets(): void {
  if (typeof document === "undefined") return;
  void prefetchPlayCoreByTier();
}

/** Prefetch hub assets when entering hub route (call from bdk-hub mount). */
export function prefetchHubHero(): void {
  if (typeof document === "undefined") return;
  const s = heroSources("bdk");
  for (const href of [s.low, s.mobile, s.desktop, s.fallback]) {
    if (document.querySelector(`link[data-xi-prefetch="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = href;
    link.setAttribute("data-xi-prefetch", href);
    document.head.appendChild(link);
  }
}

/**
 * Lobby V3 spirit dots only — never heavy particle/canvas spam.
 * LOW: 0 (static). MED: 0 (CSS light clouds only). HIGH: 4. ULTRA: 6.
 */
export function particleCountForTier(tier: QualityTier, fxEnabled: boolean): number {
  if (!fxEnabled) return 0;
  if (tier === "low" || tier === "medium") return 0;
  if (tier === "high") return 4;
  return 6;
}

/**
 * Deterministic tier for SSR + first client paint.
 * Never call detectInitialTier / collectDeviceCaps before hydrate.
 */
export const HYDRATION_BASELINE_TIER: QualityTier = "medium";

/** Prefetch lobby/hub/play route hints + journey/BDK heroes for warm nav. */
export function prefetchXiNavAssets(): void {
  if (typeof document === "undefined") return;
  const hrefs = [
    "/xi",
    "/xi/bull-demon-king",
    "/xi/bull-demon-king/play",
    ...Object.values(heroSources("journey")),
    ...Object.values(heroSources("bdk")),
  ];
  for (const href of hrefs) {
    if (document.querySelector(`link[data-xi-prefetch="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "prefetch";
    if (href.endsWith(".webp") || href.endsWith(".png") || href.endsWith(".avif")) {
      link.as = "image";
    }
    link.href = href;
    link.setAttribute("data-xi-prefetch", href);
    document.head.appendChild(link);
  }
}
