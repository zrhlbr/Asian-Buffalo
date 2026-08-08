"use client";

import { useEffect, useState } from "react";
import type { QualityMode, QualitySettings } from "./quality.ts";

type Props = {
  t: (key: string) => string;
  settings: QualitySettings;
  onChange: (next: QualitySettings) => void;
  testIdPrefix?: string;
};

const MODES: QualityMode[] = ["auto", "ultra", "high", "medium", "low"];

export function QualitySettingsPanel({
  t,
  settings,
  onChange,
  testIdPrefix = "xi-quality",
}: Props) {
  return (
    <div className="xi-quality-panel" data-testid={testIdPrefix}>
      <div className="xi-quality-row">
        <span className="xi-quality-label">{t("lobby.quality")}</span>
        <div className="xi-quality-switch">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`xi-icon-btn${settings.mode === mode ? " is-active" : ""}`}
              data-testid={`${testIdPrefix}-mode-${mode}`}
              onClick={() => onChange({ ...settings, mode })}
            >
              {t(`lobby.quality.${mode}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="xi-quality-row">
        <span className="xi-quality-label">{t("lobby.quality.fx")}</span>
        <div className="xi-quality-switch">
          <button
            type="button"
            className={`xi-icon-btn${settings.fxEnabled ? " is-active" : ""}`}
            data-testid={`${testIdPrefix}-fx-on`}
            onClick={() => onChange({ ...settings, fxEnabled: true })}
          >
            {t("lobby.quality.fxOn")}
          </button>
          <button
            type="button"
            className={`xi-icon-btn${!settings.fxEnabled ? " is-active" : ""}`}
            data-testid={`${testIdPrefix}-fx-off`}
            onClick={() => onChange({ ...settings, fxEnabled: false })}
          >
            {t("lobby.quality.fxOff")}
          </button>
        </div>
      </div>
      <div className="xi-quality-row">
        <span className="xi-quality-label">{t("lobby.quality.animal")}</span>
        <div className="xi-quality-switch">
          <button
            type="button"
            className={`xi-icon-btn${settings.animalMode === "full" ? " is-active" : ""}`}
            data-testid={`${testIdPrefix}-animal-full`}
            onClick={() => onChange({ ...settings, animalMode: "full" })}
          >
            {t("lobby.quality.animalFull")}
          </button>
          <button
            type="button"
            className={`xi-icon-btn${settings.animalMode === "simple" ? " is-active" : ""}`}
            data-testid={`${testIdPrefix}-animal-simple`}
            onClick={() => onChange({ ...settings, animalMode: "simple" })}
          >
            {t("lobby.quality.animalSimple")}
          </button>
        </div>
      </div>
      <div className="xi-quality-row">
        <span className="xi-quality-label">{t("lobby.quality.fps")}</span>
        <div className="xi-quality-switch">
          {(
            [
              ["auto", "lobby.quality.fpsAuto"],
              [30, "lobby.quality.fps30"],
              [60, "lobby.quality.fps60"],
            ] as const
          ).map(([fps, key]) => (
            <button
              key={String(fps)}
              type="button"
              className={`xi-icon-btn${settings.fpsTarget === fps ? " is-active" : ""}`}
              data-testid={`${testIdPrefix}-fps-${fps}`}
              onClick={() => onChange({ ...settings, fpsTarget: fps })}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type HeroProps = {
  kind: "journey" | "bdk";
  alt: string;
  className: string;
  testId: string;
  sources: {
    low: string;
    mobile: string;
    tablet: string;
    desktop: string;
    fallback: string;
  };
  srcSet: string;
  avifSrcSet?: string;
  sizes: string;
};

/** Progressive low→hi hero — starts on low WebP, upgrades when hi ready. */
export function ProgressiveHeroImage({
  kind,
  alt,
  className,
  testId,
  sources,
  srcSet,
  avifSrcSet,
  sizes,
}: HeroProps) {
  const [hiReady, setHiReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = sources.desktop;
    img.onload = () => {
      if (!cancelled) setHiReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setHiReady(true);
    };
    return () => {
      cancelled = true;
    };
  }, [sources.desktop, kind]);

  return (
    <picture>
      {hiReady ? (
        <>
          {avifSrcSet ? (
            <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
          ) : null}
          <source type="image/webp" srcSet={srcSet} sizes={sizes} />
          <img
            className={className}
            src={sources.fallback}
            alt={alt}
            decoding="async"
            data-testid={testId}
            data-xi-hero-tier="hi"
          />
        </>
      ) : (
        <img
          className={className}
          src={sources.low}
          alt={alt}
          decoding="async"
          data-testid={testId}
          data-xi-hero-tier="low"
        />
      )}
    </picture>
  );
}
