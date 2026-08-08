/**
 * Auth event audit log (register / login / logout / reset / OTP).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerAuthReady } from "./player-auth-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type AuthAuditEvent =
  | "auth.register.start"
  | "auth.register.verify"
  | "auth.register.complete"
  | "auth.login"
  | "auth.logout"
  | "auth.refresh"
  | "auth.forgot.start"
  | "auth.forgot.verify"
  | "auth.forgot.reset"
  | "auth.password.change"
  | "auth.otp.rate_limited"
  | "auth.login.locked";

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `aa_${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function writeAuthAudit(
  db: AppDb,
  input: {
    playerId?: string | null;
    event: AuthAuditEvent;
    channel?: string | null;
    destinationMasked?: string | null;
    ip?: string | null;
    device?: string | null;
    success: boolean;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await ensurePlayerAuthReady(db);
  await db.run(sql`
    INSERT INTO player_auth_audit
      ("id", "player_id", "event", "channel", "destination_masked", "ip", "device", "success", "detail_json")
    VALUES (
      ${newId()},
      ${input.playerId ?? null},
      ${input.event},
      ${input.channel ?? null},
      ${input.destinationMasked ?? null},
      ${input.ip ?? null},
      ${input.device ?? null},
      ${input.success ? 1 : 0},
      ${input.detail ? JSON.stringify(input.detail) : null}
    )
  `);
}
