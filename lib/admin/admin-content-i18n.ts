/**
 * Shared content locale model for Admin Content Center.
 * Canonical keys: zh / en / my (never mix zhTitle / my_title / englishText).
 * Accepts legacy VIP/activity keys zh-CN / my-MM and normalizes to canonical.
 */

export const CONTENT_LOCALES = ["zh", "en", "my"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export type LocaleBundle = Record<ContentLocale, string>;

export type LocaleCompleteness = {
  zh: boolean;
  en: boolean;
  my: boolean;
  complete: boolean;
  missing: ContentLocale[];
};

const LEGACY_ALIASES: Record<string, ContentLocale> = {
  zh: "zh",
  "zh-cn": "zh",
  "zh_cn": "zh",
  en: "en",
  "en-us": "en",
  my: "my",
  "my-mm": "my",
  "my_mm": "my",
};

export function emptyLocales(): LocaleBundle {
  return { zh: "", en: "", my: "" };
}

/** Normalize arbitrary title/body maps into canonical zh/en/my. */
export function normalizeLocaleBundle(input: unknown): LocaleBundle {
  const out = emptyLocales();
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    const canon = LEGACY_ALIASES[rawKey.trim().toLowerCase()];
    if (!canon) continue;
    if (typeof value === "string") out[canon] = value.trim();
  }
  return out;
}

export function localeCompleteness(bundle: LocaleBundle): LocaleCompleteness {
  const zh = Boolean(bundle.zh.trim());
  const en = Boolean(bundle.en.trim());
  const my = Boolean(bundle.my.trim());
  const missing = CONTENT_LOCALES.filter((k) => !bundle[k].trim());
  return { zh, en, my, complete: missing.length === 0, missing };
}

export function assertLocalesComplete(
  bundle: LocaleBundle,
): { ok: true } | { ok: false; code: "CONTENT_I18N_INCOMPLETE"; message: string; missing: ContentLocale[] } {
  const c = localeCompleteness(bundle);
  if (c.complete) return { ok: true };
  return {
    ok: false,
    code: "CONTENT_I18N_INCOMPLETE",
    message: `Publish requires zh/en/my; missing: ${c.missing.join(",")}`,
    missing: c.missing,
  };
}

/** For VIP/activity storage that still uses BCP-47 keys in DB seeds. */
export function toLegacyLocaleKeys(bundle: LocaleBundle): Record<string, string> {
  return {
    "zh-CN": bundle.zh,
    en: bundle.en,
    "my-MM": bundle.my,
    zh: bundle.zh,
    my: bundle.my,
  };
}

export function parseAnnouncementLocales(content: string): LocaleBundle & {
  publishAt: string | null;
  expiresAt: string | null;
  type: string | null;
} {
  const locales = emptyLocales();
  let publishAt: string | null = null;
  let expiresAt: string | null = null;
  let type: string | null = null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const norm = normalizeLocaleBundle(parsed);
      locales.zh = norm.zh;
      locales.en = norm.en;
      locales.my = norm.my;
      if (typeof parsed.publishAt === "string") publishAt = parsed.publishAt;
      if (typeof parsed.expiresAt === "string") expiresAt = parsed.expiresAt;
      if (typeof parsed.type === "string") type = parsed.type;
      if (!locales.zh && !locales.en && !locales.my && typeof parsed.body === "string") {
        locales.zh = parsed.body;
        locales.en = parsed.body;
        locales.my = parsed.body;
      }
      return { ...locales, publishAt, expiresAt, type };
    }
  } catch {
    /* plain */
  }
  return { zh: content, en: content, my: content, publishAt, expiresAt, type };
}
