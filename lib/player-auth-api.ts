/**
 * Player Auth HTTP API — /api/v1/auth/*
 */

import { getDb } from "../db/index.ts";
import {
  authChangePassword,
  authForgotReset,
  authForgotStart,
  authForgotVerify,
  authListSessions,
  authLogin,
  authLogout,
  authRefresh,
  authRegisterComplete,
  authRegisterStart,
  authRegisterVerify,
} from "./player-auth-service.ts";
import { resolvePlayerSession } from "./player-session.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { getPlayerProfile } from "./player-profile.ts";
import type { OtpChannel } from "./otp-providers.ts";

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

function err(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function withCookies(res: Response, cookies: string[]): Response {
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(res.body, { status: res.status, headers });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseChannel(raw: unknown): OtpChannel | null {
  if (raw === "sms" || raw === "phone") return "sms";
  if (raw === "email") return "email";
  return null;
}

function pathParts(url: URL): string[] {
  const base = "/api/v1/auth/";
  const path = url.pathname.endsWith("/") && url.pathname.length > 1
    ? url.pathname.slice(0, -1)
    : url.pathname;
  if (!path.startsWith(base)) return [];
  return path.slice(base.length).split("/").filter(Boolean);
}

export async function handlePlayerAuthApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = pathParts(url);
  const method = request.method.toUpperCase();
  const db = await getDb();
  const money = createRouteMoneyService(db);

  // GET /api/v1/auth/me
  if (method === "GET" && parts[0] === "me" && parts.length === 1) {
    const session = await resolvePlayerSession(db, request);
    if (!session) return err("UNAUTHORIZED", "Authentication required", 401);
    const profile = await getPlayerProfile(db, session.playerId);
    if (!profile) return err("PLAYER_UNAVAILABLE", "Player unavailable", 403);
    const balanceMinor = await money.getAvailableBalance(session.playerId, profile.currency);
    return json({
      playerId: session.playerId,
      sessionId: session.sessionId,
      profile,
      wallet: { currency: profile.currency, balanceMinor },
    });
  }

  // GET /api/v1/auth/sessions
  if (method === "GET" && parts[0] === "sessions" && parts.length === 1) {
    const session = await resolvePlayerSession(db, request);
    if (!session) return err("UNAUTHORIZED", "Authentication required", 401);
    return json({ sessions: await authListSessions(db, session.playerId) });
  }

  // POST routes
  if (method !== "POST") {
    return err("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const body = await readBody(request);

  if (parts[0] === "register" && parts[1] === "start" && parts.length === 2) {
    const channel = parseChannel(body?.channel);
    const destination = typeof body?.destination === "string" ? body.destination : "";
    if (!channel || !destination) return err("INVALID_REQUEST", "channel and destination required", 400);
    const result = await authRegisterStart(db, { channel, destination, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({
      challengeId: result.challengeId,
      destinationMasked: result.destinationMasked,
      expiresAt: result.expiresAt,
      testMode: result.testMode,
    });
  }

  if (parts[0] === "register" && parts[1] === "verify" && parts.length === 2) {
    const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!challengeId || !code) return err("INVALID_REQUEST", "challengeId and code required", 400);
    const result = await authRegisterVerify(db, { challengeId, code, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({ challengeId: result.challengeId, verified: true });
  }

  if (parts[0] === "register" && parts[1] === "complete" && parts.length === 2) {
    const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const nickname = typeof body?.nickname === "string" ? body.nickname : undefined;
    const lang = typeof body?.lang === "string" ? body.lang : undefined;
    if (!challengeId || !code || !password) {
      return err("INVALID_REQUEST", "challengeId, code, password required", 400);
    }
    const result = await authRegisterComplete(db, money, {
      challengeId,
      code,
      password,
      nickname,
      lang,
      request,
    });
    if (!result.ok) return err(result.code, result.message, result.status);
    return withCookies(
      json({
        playerId: result.playerId,
        profile: result.profile,
        wallet: result.wallet,
        session: {
          id: result.session.sessionId,
          expiresAt: result.session.expiresAt,
          refreshExpiresAt: result.session.refreshExpiresAt,
        },
      }),
      result.setCookies,
    );
  }

  if (parts[0] === "login" && parts.length === 1) {
    const channel = parseChannel(body?.channel);
    const destination = typeof body?.destination === "string" ? body.destination : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!channel || !destination || !password) {
      return err("INVALID_REQUEST", "channel, destination, password required", 400);
    }
    const result = await authLogin(db, money, { channel, destination, password, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return withCookies(
      json({
        playerId: result.playerId,
        profile: result.profile,
        wallet: result.wallet,
        session: {
          id: result.session.sessionId,
          expiresAt: result.session.expiresAt,
          refreshExpiresAt: result.session.refreshExpiresAt,
        },
      }),
      result.setCookies,
    );
  }

  if (parts[0] === "logout" && parts.length === 1) {
    const result = await authLogout(db, request);
    return withCookies(json({ ok: true }), result.clearCookies);
  }

  if (parts[0] === "refresh" && parts.length === 1) {
    const result = await authRefresh(db, request);
    if (!result.ok) return err(result.code, result.message, result.status);
    return withCookies(
      json({
        session: {
          id: result.session.sessionId,
          expiresAt: result.session.expiresAt,
          refreshExpiresAt: result.session.refreshExpiresAt,
        },
      }),
      result.setCookies,
    );
  }

  if (parts[0] === "forgot" && parts[1] === "start" && parts.length === 2) {
    const channel = parseChannel(body?.channel);
    const destination = typeof body?.destination === "string" ? body.destination : "";
    if (!channel || !destination) return err("INVALID_REQUEST", "channel and destination required", 400);
    const result = await authForgotStart(db, { channel, destination, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({
      challengeId: result.challengeId,
      destinationMasked: result.destinationMasked,
      expiresAt: result.expiresAt,
      testMode: result.testMode,
    });
  }

  if (parts[0] === "forgot" && parts[1] === "verify" && parts.length === 2) {
    const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!challengeId || !code) return err("INVALID_REQUEST", "challengeId and code required", 400);
    const result = await authForgotVerify(db, { challengeId, code, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({ challengeId: result.challengeId, verified: true });
  }

  if (parts[0] === "forgot" && parts[1] === "reset" && parts.length === 2) {
    const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!challengeId || !code || !password) {
      return err("INVALID_REQUEST", "challengeId, code, password required", 400);
    }
    const result = await authForgotReset(db, { challengeId, code, password, request });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({ ok: true, requireRelogin: true });
  }

  if (parts[0] === "password" && parts[1] === "change" && parts.length === 2) {
    const session = await resolvePlayerSession(db, request);
    if (!session) return err("UNAUTHORIZED", "Authentication required", 401);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || !newPassword) {
      return err("INVALID_REQUEST", "currentPassword and newPassword required", 400);
    }
    const result = await authChangePassword(db, {
      playerId: session.playerId,
      currentPassword,
      newPassword,
      request,
    });
    if (!result.ok) return err(result.code, result.message, result.status);
    return json({ ok: true });
  }

  return err("NOT_FOUND", "Unknown auth route", 404);
}
