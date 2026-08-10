/**
 * Admin PII / network / device masking (server-side).
 * Full values only when caller has players:pii:view (or devices/sessions scoped).
 */

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "****";
  const head = digits.slice(0, 2);
  const tail = digits.slice(-3);
  return `${head}${"*".repeat(Math.max(4, digits.length - 5))}${tail}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***@***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const localMask = local.length <= 2 ? `${local[0] ?? "*"}***` : `${local.slice(0, 2)}***`;
  return `${localMask}@${domain || "***"}`;
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const value = ip.trim();
  if (value.includes(":")) {
    // IPv6 — keep first 2 hextets
    const parts = value.split(":").filter((p) => p.length > 0);
    if (parts.length === 0) return "****";
    const keep = parts.slice(0, 2).join(":");
    return `${keep}:****:****`;
  }
  const octets = value.split(".");
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.*.*`;
  }
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}***`;
}

export function maskDeviceId(device: string | null | undefined): string | null {
  if (!device) return null;
  const value = device.trim();
  if (value.length <= 8) return `${value.slice(0, 2)}******`;
  return `${value.slice(0, 6)}******${value.slice(-3)}`;
}

export function maskSessionId(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  const value = sessionId.trim();
  if (value.length <= 10) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

/** Summarize User-Agent into a short client label (never return raw UA by default). */
export function summarizeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const text = ua.toLowerCase();
  let os = "Unknown";
  if (text.includes("iphone") || text.includes("ipad") || text.includes("ios")) os = "iPhone";
  else if (text.includes("android")) os = "Android";
  else if (text.includes("windows")) os = "Windows";
  else if (text.includes("mac os") || text.includes("macintosh")) os = "macOS";
  else if (text.includes("linux")) os = "Linux";

  let browser = "Browser";
  if (text.includes("edg/")) browser = "Edge";
  else if (text.includes("chrome/") && !text.includes("edg/")) browser = "Chrome";
  else if (text.includes("safari/") && !text.includes("chrome/")) browser = "Safari";
  else if (text.includes("firefox/")) browser = "Firefox";

  return `${os} / ${browser}`;
}

export type PiiViewOptions = {
  /** Full contact PII (phone/email). */
  viewPii: boolean;
  /** Full IP addresses. */
  viewDevices: boolean;
  /** Full session ids / device fingerprints. */
  viewSessions: boolean;
};

export function presentPhone(raw: string | null | undefined, opts: PiiViewOptions): string | null {
  if (!raw) return null;
  return opts.viewPii ? raw : maskPhone(raw);
}

export function presentEmail(raw: string | null | undefined, opts: PiiViewOptions): string | null {
  if (!raw) return null;
  return opts.viewPii ? raw : maskEmail(raw);
}

export function presentIp(raw: string | null | undefined, opts: PiiViewOptions): string | null {
  if (!raw) return null;
  // Full IP only with PII privilege (S-19). devices:view still sees masked IP in device lists.
  return opts.viewPii ? raw : maskIp(raw);
}

export function presentDevice(raw: string | null | undefined, opts: PiiViewOptions): string | null {
  if (!raw) return null;
  // Prefer UA summary when it looks like a user-agent; else mask id.
  if (/mozilla\/|android|iphone|windows|macintosh/i.test(raw)) {
    return opts.viewPii ? raw : summarizeUserAgent(raw);
  }
  return opts.viewPii ? raw : maskDeviceId(raw);
}

export function presentSessionId(raw: string | null | undefined, opts: PiiViewOptions): string | null {
  if (!raw) return null;
  return opts.viewSessions || opts.viewPii ? raw : maskSessionId(raw);
}
