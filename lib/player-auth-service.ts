/**
 * Player Auth service — register / login / forgot / password change.
 * Wallet init uses MoneyService.getAvailableBalance (ensure accounts at 0).
 * Never invents ledger rules or fake seed balances for auth-created players.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { writeAuthAudit } from "./player-auth-audit.ts";
import { ensurePlayerAuthReady } from "./player-auth-bootstrap.ts";
import {
  consumeOtpChallenge,
  isValidEmail,
  maskDestination,
  normalizeEmail,
  startOtpChallenge,
  verifyOtpChallenge,
  type OtpPurpose,
} from "./player-otp.ts";
import {
  hashPlayerPassword,
  isValidPassword,
  verifyPlayerPassword,
} from "./player-password.ts";
import { isValidE164, isValidNickname } from "./player-profile.ts";
import {
  buildSessionClearCookies,
  buildSessionSetCookies,
  createPlayerSession,
  extractClientDevice,
  extractClientIp,
  listPlayerSessions,
  refreshPlayerSession,
  revokeAllPlayerSessions,
  revokePlayerSession,
  type CreatedSession,
} from "./player-session.ts";
import type { MoneyService } from "./money-service.ts";
import type { OtpChannel } from "./otp-providers.ts";

type AppDb = DrizzleD1Database<typeof schema>;

const DEFAULT_CURRENCY = "MMK";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAIL = 8;
const LOCK_MS = 15 * 60 * 1000;

function newPlayerId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `pl_${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function defaultNickname(channel: OtpChannel, destination: string): string {
  if (channel === "sms") {
    const digits = destination.replace(/\D/g, "");
    return `Player_${digits.slice(-6) || "New"}`;
  }
  const local = destination.split("@")[0] ?? "Player";
  const cleaned = local.replace(/[^\p{L}\p{N}_.\-]/gu, "").slice(0, 16);
  return isValidNickname(cleaned) ? cleaned : `Player_${cleaned.slice(-4) || "New"}`;
}

async function cleanupPartialPlayer(db: AppDb, playerId: string): Promise<void> {
  await db.run(sql`DELETE FROM player_preferences WHERE player_id = ${playerId}`);
  await db.run(sql`DELETE FROM player_vip WHERE player_id = ${playerId}`);
  await db.run(sql`DELETE FROM player_profiles WHERE player_id = ${playerId}`);
  await db.run(sql`DELETE FROM player_auth_accounts WHERE player_id = ${playerId}`);
  await db.run(sql`DELETE FROM players WHERE id = ${playerId}`);
}

/**
 * Best-effort atomic init: ordered inserts + compensating delete on failure.
 * Unique constraints prevent duplicate phone/email half-accounts.
 */
async function insertPlayerBundle(
  db: AppDb,
  input: {
    playerId: string;
    channel: OtpChannel;
    destination: string;
    passwordHash: string;
    passwordSalt: string;
    passwordAlgo: string;
    nickname: string;
    lang: string;
  },
): Promise<void> {
  const phone = input.channel === "sms" ? input.destination : null;
  const email = input.channel === "email" ? input.destination : null;

  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES (${input.playerId}, ${`wallet_${input.playerId}`}, ${DEFAULT_CURRENCY}, 'ACTIVE')
  `);

  try {
    await db.run(sql`
      INSERT INTO player_auth_accounts
        ("player_id", "phone_e164", "email", "password_hash", "password_salt",
         "password_algo", "password_changed_at")
      VALUES (
        ${input.playerId}, ${phone}, ${email}, ${input.passwordHash}, ${input.passwordSalt},
        ${input.passwordAlgo}, CURRENT_TIMESTAMP
      )
    `);
    await db.run(sql`
      INSERT INTO player_profiles
        ("player_id", "nickname", "avatar_id", "phone_e164", "phone_verified",
         "status", "registered_at", "last_login_at")
      VALUES (
        ${input.playerId}, ${input.nickname}, 'ab-avatar-01', ${phone},
        ${phone ? 1 : 0}, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
    await db.run(sql`
      INSERT INTO player_vip ("player_id", "level", "status")
      VALUES (${input.playerId}, 0, 'PENDING')
    `);
    await db.run(sql`
      INSERT INTO player_preferences ("player_id", "lang")
      VALUES (${input.playerId}, ${input.lang})
    `);
  } catch (err) {
    await cleanupPartialPlayer(db, input.playerId);
    throw err;
  }
}

export type AuthServiceError = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export async function authRegisterStart(
  db: AppDb,
  input: { channel: OtpChannel; destination: string; request: Request },
): Promise<
  | {
      ok: true;
      challengeId: string;
      destinationMasked: string;
      expiresAt: string;
      testMode: boolean;
    }
  | AuthServiceError
> {
  await ensurePlayerAuthReady(db);
  const ip = extractClientIp(input.request);
  const device = extractClientDevice(input.request);

  let dest = input.destination.trim();
  if (input.channel === "sms") {
    if (!isValidE164(dest)) {
      return { ok: false, code: "INVALID_PHONE", message: "Phone must be E.164", status: 400 };
    }
  } else {
    if (!isValidEmail(dest)) {
      return { ok: false, code: "INVALID_EMAIL", message: "Invalid email", status: 400 };
    }
    dest = normalizeEmail(dest);
  }

  // Conflict check
  const existing =
    input.channel === "sms"
      ? await db.all<{ n: number }>(sql`
          SELECT COUNT(*) AS n FROM player_auth_accounts WHERE phone_e164 = ${dest}
        `)
      : await db.all<{ n: number }>(sql`
          SELECT COUNT(*) AS n FROM player_auth_accounts WHERE email = ${dest}
        `);
  if (Number(existing[0]?.n ?? 0) > 0) {
    await writeAuthAudit(db, {
      event: "auth.register.start",
      channel: input.channel,
      destinationMasked: maskDestination(input.channel, dest),
      ip,
      device,
      success: false,
      detail: { reason: "already_registered" },
    });
    return {
      ok: false,
      code: "ALREADY_REGISTERED",
      message: "Account already registered",
      status: 409,
    };
  }

  const started = await startOtpChallenge(db, {
    channel: input.channel,
    destination: dest,
    purpose: "register",
    ip,
  });
  await writeAuthAudit(db, {
    event: "auth.register.start",
    channel: input.channel,
    destinationMasked: maskDestination(input.channel, dest),
    ip,
    device,
    success: started.ok,
    detail: started.ok ? { challengeId: started.challengeId } : { code: started.code },
  });
  if (!started.ok) {
    return {
      ok: false,
      code: started.code,
      message: started.message,
      status: started.status,
    };
  }
  return {
    ok: true,
    challengeId: started.challengeId,
    destinationMasked: started.destinationMasked,
    expiresAt: started.expiresAt,
    testMode: started.testMode,
  };
}

export async function authRegisterVerify(
  db: AppDb,
  input: { challengeId: string; code: string; request: Request },
): Promise<{ ok: true; challengeId: string } | AuthServiceError> {
  await ensurePlayerAuthReady(db);
  const verified = await verifyOtpChallenge(db, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: "register",
  });
  await writeAuthAudit(db, {
    event: "auth.register.verify",
    ip: extractClientIp(input.request),
    device: extractClientDevice(input.request),
    success: verified.ok,
    detail: verified.ok
      ? { challengeId: verified.challengeId }
      : { code: verified.code },
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code,
      message: verified.message,
      status: verified.status,
    };
  }
  return { ok: true, challengeId: verified.challengeId };
}

export async function authRegisterComplete(
  db: AppDb,
  money: MoneyService,
  input: {
    challengeId: string;
    code: string;
    password: string;
    nickname?: string;
    lang?: string;
    request: Request;
  },
): Promise<
  | {
      ok: true;
      playerId: string;
      session: CreatedSession;
      setCookies: string[];
      profile: { nickname: string; vipLevel: number; avatarUrl: string; playerId: string };
      wallet: { currency: string; balanceMinor: number };
    }
  | AuthServiceError
> {
  await ensurePlayerAuthReady(db);
  const ip = extractClientIp(input.request);
  const device = extractClientDevice(input.request);

  if (!isValidPassword(input.password)) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      message: "Password must be 8–72 chars with letter and digit",
      status: 400,
    };
  }

  const verified = await verifyOtpChallenge(db, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: "register",
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code,
      message: verified.message,
      status: verified.status,
    };
  }

  const nick =
    input.nickname && isValidNickname(input.nickname)
      ? input.nickname.trim()
      : defaultNickname(verified.channel, verified.destination);
  const lang =
    input.lang === "en" || input.lang === "my-MM" || input.lang === "zh-CN"
      ? input.lang
      : "zh-CN";

  // Duplicate guard (race)
  const conflict =
    verified.channel === "sms"
      ? await db.all<{ n: number }>(sql`
          SELECT COUNT(*) AS n FROM player_auth_accounts
          WHERE phone_e164 = ${verified.destination}
        `)
      : await db.all<{ n: number }>(sql`
          SELECT COUNT(*) AS n FROM player_auth_accounts
          WHERE email = ${verified.destination}
        `);
  if (Number(conflict[0]?.n ?? 0) > 0) {
    return {
      ok: false,
      code: "ALREADY_REGISTERED",
      message: "Account already registered",
      status: 409,
    };
  }

  const hashed = await hashPlayerPassword(input.password);
  const playerId = newPlayerId();

  try {
    await insertPlayerBundle(db, {
      playerId,
      channel: verified.channel,
      destination: verified.destination,
      passwordHash: hashed.hash,
      passwordSalt: hashed.salt,
      passwordAlgo: hashed.algo,
      nickname: nick,
      lang,
    });
  } catch {
    await writeAuthAudit(db, {
      event: "auth.register.complete",
      channel: verified.channel,
      destinationMasked: maskDestination(verified.channel, verified.destination),
      ip,
      device,
      success: false,
      detail: { reason: "init_failed" },
    });
    return {
      ok: false,
      code: "REGISTER_FAILED",
      message: "Registration failed; please retry",
      status: 500,
    };
  }

  await consumeOtpChallenge(db, verified.challengeId);

  // Wallet accounts at 0 — no seed / no fake balance
  const balanceMinor = await money.getAvailableBalance(playerId, DEFAULT_CURRENCY);

  const session = await createPlayerSession(db, {
    playerId,
    ip,
    device,
    userAgent: input.request.headers.get("user-agent") ?? "",
  });

  await writeAuthAudit(db, {
    playerId,
    event: "auth.register.complete",
    channel: verified.channel,
    destinationMasked: maskDestination(verified.channel, verified.destination),
    ip,
    device,
    success: true,
  });

  return {
    ok: true,
    playerId,
    session,
    setCookies: buildSessionSetCookies(session.accessToken, session.refreshToken),
    profile: {
      nickname: nick,
      vipLevel: 0,
      avatarUrl: "/avatars/ab-avatar-01.svg",
      playerId,
    },
    wallet: { currency: DEFAULT_CURRENCY, balanceMinor },
  };
}

async function findAuthByLogin(
  db: AppDb,
  channel: OtpChannel,
  destination: string,
): Promise<Record<string, unknown> | null> {
  const rows =
    channel === "sms"
      ? await db.all<Record<string, unknown>>(sql`
          SELECT a.*, p.status AS player_status
          FROM player_auth_accounts a
          JOIN players p ON p.id = a.player_id
          WHERE a.phone_e164 = ${destination}
          LIMIT 1
        `)
      : await db.all<Record<string, unknown>>(sql`
          SELECT a.*, p.status AS player_status
          FROM player_auth_accounts a
          JOIN players p ON p.id = a.player_id
          WHERE a.email = ${destination}
          LIMIT 1
        `);
  return rows[0] ?? null;
}

export async function authLogin(
  db: AppDb,
  money: MoneyService,
  input: {
    channel: OtpChannel;
    destination: string;
    password: string;
    request: Request;
  },
): Promise<
  | {
      ok: true;
      playerId: string;
      session: CreatedSession;
      setCookies: string[];
      profile: { nickname: string; vipLevel: number; avatarUrl: string; playerId: string };
      wallet: { currency: string; balanceMinor: number };
    }
  | AuthServiceError
> {
  await ensurePlayerAuthReady(db);
  const ip = extractClientIp(input.request);
  const device = extractClientDevice(input.request);

  let dest = input.destination.trim();
  if (input.channel === "sms") {
    if (!isValidE164(dest)) {
      return { ok: false, code: "INVALID_PHONE", message: "Phone must be E.164", status: 400 };
    }
  } else {
    if (!isValidEmail(dest)) {
      return { ok: false, code: "INVALID_EMAIL", message: "Invalid email", status: 400 };
    }
    dest = normalizeEmail(dest);
  }

  const loginKey = `login:${input.channel}:${dest}`;
  const rateRows = await db.all<{ count: number; window_started_at: string }>(sql`
    SELECT count, window_started_at FROM player_auth_rate_limits
    WHERE bucket_key = ${loginKey} LIMIT 1
  `);
  const rate = rateRows[0];
  if (rate) {
    const started = Date.parse(rate.window_started_at);
    if (Number.isFinite(started) && Date.now() - started <= LOGIN_WINDOW_MS) {
      if (Number(rate.count) >= LOGIN_MAX_FAIL) {
        await writeAuthAudit(db, {
          event: "auth.login.locked",
          channel: input.channel,
          destinationMasked: maskDestination(input.channel, dest),
          ip,
          device,
          success: false,
        });
        return {
          ok: false,
          code: "LOGIN_RATE_LIMITED",
          message: "Too many login attempts; try later",
          status: 429,
        };
      }
    }
  }

  const account = await findAuthByLogin(db, input.channel, dest);
  if (!account || String(account.status) !== "ACTIVE" || String(account.player_status) !== "ACTIVE") {
    await bumpLoginFail(db, loginKey);
    await writeAuthAudit(db, {
      event: "auth.login",
      channel: input.channel,
      destinationMasked: maskDestination(input.channel, dest),
      ip,
      device,
      success: false,
      detail: { reason: "not_found" },
    });
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials", status: 401 };
  }

  if (account.locked_until && Date.parse(String(account.locked_until)) > Date.now()) {
    return {
      ok: false,
      code: "ACCOUNT_LOCKED",
      message: "Account temporarily locked",
      status: 423,
    };
  }

  const okPass = await verifyPlayerPassword(input.password, {
    passwordHash: String(account.password_hash),
    passwordSalt: String(account.password_salt),
    passwordAlgo: String(account.password_algo ?? "pbkdf2-sha256"),
  });
  if (!okPass) {
    const fails = Number(account.failed_login_count ?? 0) + 1;
    const lockedUntil =
      fails >= LOGIN_MAX_FAIL ? new Date(Date.now() + LOCK_MS).toISOString() : null;
    await db.run(sql`
      UPDATE player_auth_accounts
      SET failed_login_count = ${fails},
          locked_until = ${lockedUntil},
          updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ${String(account.player_id)}
    `);
    await bumpLoginFail(db, loginKey);
    await writeAuthAudit(db, {
      playerId: String(account.player_id),
      event: "auth.login",
      channel: input.channel,
      destinationMasked: maskDestination(input.channel, dest),
      ip,
      device,
      success: false,
      detail: { reason: "bad_password" },
    });
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials", status: 401 };
  }

  await db.run(sql`
    UPDATE player_auth_accounts
    SET failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${String(account.player_id)}
  `);
  await db.run(sql`
    UPDATE player_profiles
    SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${String(account.player_id)}
  `);

  const playerId = String(account.player_id);
  const balanceMinor = await money.getAvailableBalance(playerId, DEFAULT_CURRENCY);
  const session = await createPlayerSession(db, {
    playerId,
    ip,
    device,
    userAgent: input.request.headers.get("user-agent") ?? "",
  });

  const profileRows = await db.all<Record<string, unknown>>(sql`
    SELECT pf.nickname, pf.avatar_id, COALESCE(v.level, 0) AS vip_level
    FROM player_profiles pf
    LEFT JOIN player_vip v ON v.player_id = pf.player_id
    WHERE pf.player_id = ${playerId}
    LIMIT 1
  `);
  const pf = profileRows[0];
  const avatarId = String(pf?.avatar_id ?? "ab-avatar-01");

  await writeAuthAudit(db, {
    playerId,
    event: "auth.login",
    channel: input.channel,
    destinationMasked: maskDestination(input.channel, dest),
    ip,
    device,
    success: true,
  });

  return {
    ok: true,
    playerId,
    session,
    setCookies: buildSessionSetCookies(session.accessToken, session.refreshToken),
    profile: {
      nickname: String(pf?.nickname ?? ""),
      vipLevel: Number(pf?.vip_level ?? 0),
      avatarUrl: `/avatars/${avatarId}.svg`,
      playerId,
    },
    wallet: { currency: DEFAULT_CURRENCY, balanceMinor },
  };
}

async function bumpLoginFail(db: AppDb, loginKey: string): Promise<void> {
  const rows = await db.all<{ count: number; window_started_at: string }>(sql`
    SELECT count, window_started_at FROM player_auth_rate_limits
    WHERE bucket_key = ${loginKey} LIMIT 1
  `);
  const row = rows[0];
  const now = Date.now();
  if (!row || !Number.isFinite(Date.parse(row.window_started_at)) || now - Date.parse(row.window_started_at) > LOGIN_WINDOW_MS) {
    await db.run(sql`
      INSERT INTO player_auth_rate_limits ("bucket_key", "count", "window_started_at")
      VALUES (${loginKey}, 1, ${new Date(now).toISOString()})
      ON CONFLICT("bucket_key") DO UPDATE SET
        count = 1,
        window_started_at = ${new Date(now).toISOString()},
        updated_at = CURRENT_TIMESTAMP
    `);
    return;
  }
  await db.run(sql`
    UPDATE player_auth_rate_limits
    SET count = count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE bucket_key = ${loginKey}
  `);
}

export async function authForgotStart(
  db: AppDb,
  input: { channel: OtpChannel; destination: string; request: Request },
): Promise<
  | {
      ok: true;
      challengeId: string;
      destinationMasked: string;
      expiresAt: string;
      testMode: boolean;
    }
  | AuthServiceError
> {
  await ensurePlayerAuthReady(db);
  const ip = extractClientIp(input.request);
  let dest = input.destination.trim();
  if (input.channel === "sms") {
    if (!isValidE164(dest)) {
      return { ok: false, code: "INVALID_PHONE", message: "Phone must be E.164", status: 400 };
    }
  } else {
    if (!isValidEmail(dest)) {
      return { ok: false, code: "INVALID_EMAIL", message: "Invalid email", status: 400 };
    }
    dest = normalizeEmail(dest);
  }

  const account = await findAuthByLogin(db, input.channel, dest);
  // Anti-enumeration: same success shape when missing, but only send OTP if exists
  if (!account) {
    await writeAuthAudit(db, {
      event: "auth.forgot.start",
      channel: input.channel,
      destinationMasked: maskDestination(input.channel, dest),
      ip,
      device: extractClientDevice(input.request),
      success: true,
      detail: { reason: "noop_unknown" },
    });
    // Still require provider path for consistent UX in test mode — create challenge only if account exists
    return {
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "Account not found",
      status: 404,
    };
  }

  const started = await startOtpChallenge(db, {
    channel: input.channel,
    destination: dest,
    purpose: "reset",
    ip,
  });
  await writeAuthAudit(db, {
    playerId: String(account.player_id),
    event: "auth.forgot.start",
    channel: input.channel,
    destinationMasked: maskDestination(input.channel, dest),
    ip,
    device: extractClientDevice(input.request),
    success: started.ok,
  });
  if (!started.ok) {
    return {
      ok: false,
      code: started.code,
      message: started.message,
      status: started.status,
    };
  }
  return {
    ok: true,
    challengeId: started.challengeId,
    destinationMasked: started.destinationMasked,
    expiresAt: started.expiresAt,
    testMode: started.testMode,
  };
}

export async function authForgotVerify(
  db: AppDb,
  input: { challengeId: string; code: string; request: Request },
): Promise<{ ok: true; challengeId: string } | AuthServiceError> {
  const verified = await verifyOtpChallenge(db, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: "reset",
  });
  await writeAuthAudit(db, {
    event: "auth.forgot.verify",
    ip: extractClientIp(input.request),
    device: extractClientDevice(input.request),
    success: verified.ok,
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code,
      message: verified.message,
      status: verified.status,
    };
  }
  return { ok: true, challengeId: verified.challengeId };
}

export async function authForgotReset(
  db: AppDb,
  input: {
    challengeId: string;
    code: string;
    password: string;
    request: Request;
  },
): Promise<{ ok: true } | AuthServiceError> {
  await ensurePlayerAuthReady(db);
  if (!isValidPassword(input.password)) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      message: "Password must be 8–72 chars with letter and digit",
      status: 400,
    };
  }
  const verified = await verifyOtpChallenge(db, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: "reset",
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code,
      message: verified.message,
      status: verified.status,
    };
  }

  const account = await findAuthByLogin(db, verified.channel, verified.destination);
  if (!account) {
    return { ok: false, code: "ACCOUNT_NOT_FOUND", message: "Account not found", status: 404 };
  }

  const hashed = await hashPlayerPassword(input.password);
  await db.run(sql`
    UPDATE player_auth_accounts
    SET password_hash = ${hashed.hash},
        password_salt = ${hashed.salt},
        password_algo = ${hashed.algo},
        password_changed_at = CURRENT_TIMESTAMP,
        failed_login_count = 0,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${String(account.player_id)}
  `);
  await consumeOtpChallenge(db, verified.challengeId);
  await revokeAllPlayerSessions(db, String(account.player_id));

  await writeAuthAudit(db, {
    playerId: String(account.player_id),
    event: "auth.forgot.reset",
    channel: verified.channel,
    destinationMasked: maskDestination(verified.channel, verified.destination),
    ip: extractClientIp(input.request),
    device: extractClientDevice(input.request),
    success: true,
  });

  return { ok: true };
}

export async function authChangePassword(
  db: AppDb,
  input: {
    playerId: string;
    currentPassword: string;
    newPassword: string;
    request: Request;
  },
): Promise<{ ok: true } | AuthServiceError> {
  await ensurePlayerAuthReady(db);
  if (!isValidPassword(input.newPassword)) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      message: "Password must be 8–72 chars with letter and digit",
      status: 400,
    };
  }
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM player_auth_accounts WHERE player_id = ${input.playerId} LIMIT 1
  `);
  const account = rows[0];
  if (!account) {
    return { ok: false, code: "ACCOUNT_NOT_FOUND", message: "Account not found", status: 404 };
  }
  const okPass = await verifyPlayerPassword(input.currentPassword, {
    passwordHash: String(account.password_hash),
    passwordSalt: String(account.password_salt),
    passwordAlgo: String(account.password_algo ?? "pbkdf2-sha256"),
  });
  if (!okPass) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials", status: 401 };
  }
  const hashed = await hashPlayerPassword(input.newPassword);
  await db.run(sql`
    UPDATE player_auth_accounts
    SET password_hash = ${hashed.hash},
        password_salt = ${hashed.salt},
        password_algo = ${hashed.algo},
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${input.playerId}
  `);
  await writeAuthAudit(db, {
    playerId: input.playerId,
    event: "auth.password.change",
    ip: extractClientIp(input.request),
    device: extractClientDevice(input.request),
    success: true,
  });
  return { ok: true };
}

export async function authLogout(
  db: AppDb,
  request: Request,
): Promise<{ ok: true; clearCookies: string[] }> {
  const playerId = await revokePlayerSession(db, request);
  if (playerId) {
    await writeAuthAudit(db, {
      playerId,
      event: "auth.logout",
      ip: extractClientIp(request),
      device: extractClientDevice(request),
      success: true,
    });
  }
  return { ok: true, clearCookies: buildSessionClearCookies() };
}

export async function authRefresh(
  db: AppDb,
  request: Request,
): Promise<
  | { ok: true; session: CreatedSession; setCookies: string[] }
  | AuthServiceError
> {
  const session = await refreshPlayerSession(db, request);
  if (!session) {
    return { ok: false, code: "REFRESH_INVALID", message: "Refresh token invalid", status: 401 };
  }
  await writeAuthAudit(db, {
    playerId: session.playerId,
    event: "auth.refresh",
    ip: extractClientIp(request),
    device: extractClientDevice(request),
    success: true,
    detail: { sessionId: session.sessionId },
  });
  return {
    ok: true,
    session,
    setCookies: buildSessionSetCookies(session.accessToken, session.refreshToken),
  };
}

export async function authListSessions(db: AppDb, playerId: string) {
  return listPlayerSessions(db, playerId);
}

export type { OtpChannel, OtpPurpose };
