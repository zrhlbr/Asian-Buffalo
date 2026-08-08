/**
 * OTP challenge lifecycle + rate limits for player Auth.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerAuthReady } from "./player-auth-bootstrap.ts";
import {
  AUTH_OTP_TEST_CODE,
  createDefaultEmailProvider,
  createDefaultSmsProvider,
  isAuthOtpTestMode,
  type OtpChannel,
} from "./otp-providers.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type OtpPurpose = "register" | "reset";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const OTP_SEND_MAX = 5;
const OTP_IP_WINDOW_MS = 15 * 60 * 1000;
const OTP_IP_MAX = 20;

function newId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashOtpCode(code: string): Promise<string> {
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`otp:${code}`));
  return toHex(dig);
}

function generateNumericOtp(): string {
  if (isAuthOtpTestMode()) return AUTH_OTP_TEST_CODE;
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

async function rateLimitAllow(
  db: AppDb,
  bucketKey: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  await ensurePlayerAuthReady(db);
  const now = Date.now();
  const rows = await db.all<{ count: number; window_started_at: string }>(sql`
    SELECT count, window_started_at FROM player_auth_rate_limits
    WHERE bucket_key = ${bucketKey} LIMIT 1
  `);
  const row = rows[0];
  if (!row) {
    await db.run(sql`
      INSERT INTO player_auth_rate_limits ("bucket_key", "count", "window_started_at")
      VALUES (${bucketKey}, 1, ${new Date(now).toISOString()})
    `);
    return true;
  }
  const started = Date.parse(row.window_started_at);
  if (!Number.isFinite(started) || now - started > windowMs) {
    await db.run(sql`
      UPDATE player_auth_rate_limits
      SET count = 1, window_started_at = ${new Date(now).toISOString()},
          updated_at = CURRENT_TIMESTAMP
      WHERE bucket_key = ${bucketKey}
    `);
    return true;
  }
  if (Number(row.count) >= max) return false;
  await db.run(sql`
    UPDATE player_auth_rate_limits
    SET count = count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE bucket_key = ${bucketKey}
  `);
  return true;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  if (e.length < 5 || e.length > 120) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function maskDestination(channel: OtpChannel, destination: string): string {
  if (channel === "sms") {
    const digits = destination.replace(/\D/g, "");
    if (digits.length < 4) return "****";
    return `****${digits.slice(-4)}`;
  }
  const [user, domain] = destination.split("@");
  if (!user || !domain) return "***";
  const u = user.length <= 2 ? "*" : `${user[0]}***${user[user.length - 1]}`;
  return `${u}@${domain}`;
}

export type StartOtpResult =
  | {
      ok: true;
      challengeId: string;
      channel: OtpChannel;
      destinationMasked: string;
      expiresAt: string;
      testMode: boolean;
    }
  | { ok: false; code: string; message: string; status: number };

export async function startOtpChallenge(
  db: AppDb,
  input: {
    channel: OtpChannel;
    destination: string;
    purpose: OtpPurpose;
    ip: string;
  },
): Promise<StartOtpResult> {
  await ensurePlayerAuthReady(db);
  const dest =
    input.channel === "email" ? normalizeEmail(input.destination) : input.destination.trim();

  const destKey = `otp:send:${input.purpose}:${input.channel}:${dest}`;
  const ipKey = `otp:ip:${input.ip}`;
  if (!(await rateLimitAllow(db, destKey, OTP_SEND_MAX, OTP_SEND_WINDOW_MS))) {
    return {
      ok: false,
      code: "OTP_RATE_LIMITED",
      message: "Too many OTP requests; try later",
      status: 429,
    };
  }
  if (!(await rateLimitAllow(db, ipKey, OTP_IP_MAX, OTP_IP_WINDOW_MS))) {
    return {
      ok: false,
      code: "OTP_RATE_LIMITED",
      message: "Too many OTP requests from this network",
      status: 429,
    };
  }

  const code = generateNumericOtp();
  const codeHash = await hashOtpCode(code);
  const id = newId("otp");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Deliver via stub providers (fail-closed outside test mode / live config)
  if (input.channel === "sms") {
    const sms = createDefaultSmsProvider();
    const sent = await sms.sendSms(dest, `XI GAME OTP: ${code}`);
    if (!sent.ok) {
      return { ok: false, code: sent.code, message: sent.message, status: 503 };
    }
  } else {
    const mail = createDefaultEmailProvider();
    const sent = await mail.sendEmail(dest, "XI GAME OTP", `Your code: ${code}`);
    if (!sent.ok) {
      return { ok: false, code: sent.code, message: sent.message, status: 503 };
    }
  }

  await db.run(sql`
    INSERT INTO player_otp_challenges
      ("id", "channel", "destination", "purpose", "code_hash", "expires_at", "ip")
    VALUES (
      ${id}, ${input.channel}, ${dest}, ${input.purpose}, ${codeHash}, ${expiresAt}, ${input.ip}
    )
  `);

  return {
    ok: true,
    challengeId: id,
    channel: input.channel,
    destinationMasked: maskDestination(input.channel, dest),
    expiresAt,
    testMode: isAuthOtpTestMode(),
  };
}

export type VerifyOtpResult =
  | { ok: true; challengeId: string; destination: string; channel: OtpChannel; purpose: OtpPurpose }
  | { ok: false; code: string; message: string; status: number };

export async function verifyOtpChallenge(
  db: AppDb,
  input: { challengeId: string; code: string; purpose: OtpPurpose },
): Promise<VerifyOtpResult> {
  await ensurePlayerAuthReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, channel, destination, purpose, code_hash, attempts, max_attempts,
           verified_at, consumed_at, expires_at
    FROM player_otp_challenges WHERE id = ${input.challengeId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) {
    return { ok: false, code: "OTP_NOT_FOUND", message: "OTP challenge not found", status: 404 };
  }
  if (String(row.purpose) !== input.purpose) {
    return { ok: false, code: "OTP_PURPOSE_MISMATCH", message: "OTP purpose mismatch", status: 400 };
  }
  if (row.consumed_at) {
    return { ok: false, code: "OTP_CONSUMED", message: "OTP already used", status: 400 };
  }
  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    return { ok: false, code: "OTP_EXPIRED", message: "OTP expired", status: 400 };
  }
  if (Number(row.attempts) >= Number(row.max_attempts)) {
    return { ok: false, code: "OTP_LOCKED", message: "Too many OTP attempts", status: 429 };
  }

  const expect = String(row.code_hash);
  const actual = await hashOtpCode(input.code.trim());
  const match =
    actual === expect ||
    (isAuthOtpTestMode() && input.code.trim() === AUTH_OTP_TEST_CODE);

  await db.run(sql`
    UPDATE player_otp_challenges
    SET attempts = attempts + 1
    WHERE id = ${input.challengeId}
  `);

  if (!match) {
    return { ok: false, code: "OTP_INVALID", message: "Invalid OTP code", status: 400 };
  }

  await db.run(sql`
    UPDATE player_otp_challenges
    SET verified_at = CURRENT_TIMESTAMP
    WHERE id = ${input.challengeId}
  `);

  return {
    ok: true,
    challengeId: String(row.id),
    destination: String(row.destination),
    channel: String(row.channel) as OtpChannel,
    purpose: String(row.purpose) as OtpPurpose,
  };
}

export async function consumeOtpChallenge(db: AppDb, challengeId: string): Promise<void> {
  await db.run(sql`
    UPDATE player_otp_challenges
    SET consumed_at = CURRENT_TIMESTAMP
    WHERE id = ${challengeId}
  `);
}
