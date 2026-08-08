/**
 * Payment / wallet-commerce production readiness (BR-005..007).
 * Never invent Zhao production fees/presets/secrets — fail closed until signed off.
 */

import { isDevTestIdentityEnabled } from "./runtime-identity.ts";

export type ChannelReadiness = {
  code: string;
  currency: string;
  enabled: boolean;
  productionReady: boolean;
  status: "TEMP" | "NOT_PRODUCTION_READY" | "PRODUCTION";
  provider: string;
  callbackConfigured: boolean;
  timeoutMs: number | null;
  reconEnabled: boolean;
  minMinor: number | null;
  maxMinor: number | null;
  feeMinor: number | null;
  note: string;
};

export type CommerceReadiness = {
  status: "NOT_PRODUCTION_READY" | "PRODUCTION";
  productionReady: boolean;
  code: "NOT_PRODUCTION_READY" | "PRODUCTION_READY";
  reason: string;
  testHarnessAllowed: boolean;
  brRefs: string[];
  channels: ChannelReadiness[];
};

type ChannelConfig = {
  note?: string;
  productionReady?: boolean;
  provider?: string;
  callbackConfigured?: boolean;
  timeoutMs?: number | null;
  reconEnabled?: boolean;
  minMinor?: number | null;
  maxMinor?: number | null;
  feeMinor?: number | null;
};

function parseConfig(raw: unknown): ChannelConfig {
  if (typeof raw !== "string") {
    if (raw && typeof raw === "object") return raw as ChannelConfig;
    return {};
  }
  try {
    return JSON.parse(raw) as ChannelConfig;
  } catch {
    return {};
  }
}

export function mapChannelReadiness(input: {
  code: string;
  currency: string;
  enabled: boolean;
  configJson?: unknown;
}): ChannelReadiness {
  const cfg = parseConfig(input.configJson);
  const productionReady = cfg.productionReady === true;
  const callbackConfigured = cfg.callbackConfigured === true;
  const provider = typeof cfg.provider === "string" && cfg.provider ? cfg.provider : "TEMP";
  let status: ChannelReadiness["status"] = "NOT_PRODUCTION_READY";
  if (productionReady && callbackConfigured && provider !== "TEMP") {
    status = "PRODUCTION";
  } else if (provider === "TEMP") {
    status = "TEMP";
  }
  return {
    code: input.code,
    currency: input.currency,
    enabled: input.enabled,
    productionReady: status === "PRODUCTION",
    status,
    provider,
    callbackConfigured,
    timeoutMs: typeof cfg.timeoutMs === "number" ? cfg.timeoutMs : null,
    reconEnabled: cfg.reconEnabled === true,
    minMinor: typeof cfg.minMinor === "number" ? cfg.minMinor : null,
    maxMinor: typeof cfg.maxMinor === "number" ? cfg.maxMinor : null,
    feeMinor: typeof cfg.feeMinor === "number" ? cfg.feeMinor : null,
    note: typeof cfg.note === "string" ? cfg.note : "BR-007 PENDING credentials",
  };
}

export function buildCommerceReadiness(
  channels: ChannelReadiness[],
  opts?: { depositProductionReady?: boolean; withdrawalProductionReady?: boolean },
): CommerceReadiness {
  const anyLive = channels.some((c) => c.productionReady && c.callbackConfigured);
  const depositOk = opts?.depositProductionReady === true;
  const withdrawOk = opts?.withdrawalProductionReady === true;
  const productionReady = anyLive && depositOk && withdrawOk;
  return {
    status: productionReady ? "PRODUCTION" : "NOT_PRODUCTION_READY",
    productionReady,
    code: productionReady ? "PRODUCTION_READY" : "NOT_PRODUCTION_READY",
    reason: productionReady
      ? "Signed-off production channels and commerce thresholds"
      : "BR-005/006/007 placeholders or live provider secrets unset — fail closed",
    testHarnessAllowed: isDevTestIdentityEnabled(),
    brRefs: ["BR-005", "BR-006", "BR-007", "BR-009"],
    channels,
  };
}

/** Config value marked production-ready only when admin explicitly sets the flag. */
export function configIsProductionReady(value: Record<string, unknown> | null | undefined): boolean {
  return value?.productionReady === true;
}
