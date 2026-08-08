/**
 * Xi shared UI store — hydration-safe quality / hydrated flag.
 * Presentation only. SSR + first client paint use deterministic defaults;
 * storage / device tier sync runs after hydrate.
 */
import {
  applyDocumentQuality,
  defaultQualitySettings,
  readStoredQualitySettings,
  storeQualitySettings,
  type QualitySettings,
} from "./quality.ts";

const qualityListeners = new Set<() => void>();
const hydratedListeners = new Set<() => void>();

/** Stable referential default for SSR / getServerSnapshot (React requirement). */
const SERVER_QUALITY_DEFAULT: QualitySettings = defaultQualitySettings();

let qualitySettings: QualitySettings = SERVER_QUALITY_DEFAULT;
let hydrated = false;

function emitQuality(): void {
  for (const listener of qualityListeners) listener();
}

function emitHydrated(): void {
  for (const listener of hydratedListeners) listener();
}

export function subscribeXiQuality(onStoreChange: () => void): () => void {
  qualityListeners.add(onStoreChange);
  return () => {
    qualityListeners.delete(onStoreChange);
  };
}

export function getXiQualitySnapshot(): QualitySettings {
  return qualitySettings;
}

/** Always defaults — never read localStorage / device here. */
export function getXiQualityServerSnapshot(): QualitySettings {
  return SERVER_QUALITY_DEFAULT;
}

export function subscribeXiHydrated(onStoreChange: () => void): () => void {
  hydratedListeners.add(onStoreChange);
  return () => {
    hydratedListeners.delete(onStoreChange);
  };
}

export function getXiHydratedSnapshot(): boolean {
  return hydrated;
}

export function getXiHydratedServerSnapshot(): boolean {
  return false;
}

/** Call once after mount — sync quality from storage, mark hydrated. */
export function hydrateXiUiStore(): void {
  if (hydrated) return;
  qualitySettings = readStoredQualitySettings();
  hydrated = true;
  applyDocumentQuality(qualitySettings);
  emitQuality();
  emitHydrated();
  if (typeof window !== "undefined") {
    (window as unknown as { __xiUiHydrated?: boolean }).__xiUiHydrated = true;
  }
}

export function setXiQualitySettings(next: QualitySettings): void {
  qualitySettings = next;
  storeQualitySettings(next);
  if (hydrated) applyDocumentQuality(next);
  emitQuality();
}
