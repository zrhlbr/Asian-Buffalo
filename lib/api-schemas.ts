/**
 * Public API request schemas.
 *
 * These schemas intentionally expose only the fields the client is allowed to
 * submit. Player identity, currency, free-game state, math version, and any
 * outcome data are derived server-side and rejected if present in the request
 * body.
 */

import {
  identifierField,
  intField,
  validateObject,
} from "./validation.ts";

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const sessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type CreateSessionRequest = Record<string, never>;

export function validateCreateSessionRequest(payload: unknown): CreateSessionRequest {
  return validateObject<CreateSessionRequest>({}, payload, "createSession");
}

export type PublicSpinRequest = {
  sessionId: string;
  roomBase: number;
  betLevel: number;
  betMultiplier: number;
  idempotencyKey: string;
};

export function validateSpinRequest(payload: unknown): PublicSpinRequest {
  return validateObject<PublicSpinRequest>(
    {
      sessionId: identifierField({
        maxLen: 128,
        pattern: sessionIdPattern,
      }),
      roomBase: intField(1, 1_000_000),
      betLevel: intField(1, 1_000),
      betMultiplier: intField(1, 1_000_000),
      idempotencyKey: identifierField({
        maxLen: 128,
        pattern: idPattern,
      }),
    },
    payload,
    "spin",
  );
}
