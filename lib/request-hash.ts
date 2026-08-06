/**
 * Canonical request hashing for spin idempotency.
 * Uses a fixed key order so JSON field ordering cannot change the hash.
 */

import type { PublicSpinRequest } from "./api-schemas.ts";

export function canonicalizeSpinRequest(request: PublicSpinRequest): string {
  return JSON.stringify({
    betLevel: request.betLevel,
    betMultiplier: request.betMultiplier,
    idempotencyKey: request.idempotencyKey,
    roomBase: request.roomBase,
    sessionId: request.sessionId,
  });
}

export async function hashSpinRequest(request: PublicSpinRequest): Promise<string> {
  const canonical = canonicalizeSpinRequest(request);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
