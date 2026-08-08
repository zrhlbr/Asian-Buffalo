/** Client helpers for /api/v1/auth/* — credentials same-origin. */

export type AuthChannel = "sms" | "email";

export type AuthApiError = { code: string; message: string };

export type AuthProfileSnap = {
  nickname: string;
  vipLevel: number;
  avatarUrl: string;
  playerId: string;
};

export type AuthWalletSnap = {
  currency: string;
  balanceMinor: number;
};

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function postAuth<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: AuthApiError }> {
  try {
    const res = await fetch(`/api/v1/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await readJson(res)) as {
      error?: AuthApiError;
    } & T;
    if (!res.ok) {
      return {
        ok: false,
        error: {
          code: json?.error?.code ?? "REQUEST_FAILED",
          message: json?.error?.message ?? "request failed",
        },
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "network error" } };
  }
}

export function authRegisterStart(channel: AuthChannel, destination: string) {
  return postAuth<{
    challengeId: string;
    destinationMasked: string;
    expiresAt: string;
    testMode: boolean;
  }>("register/start", { channel, destination });
}

export function authRegisterVerify(challengeId: string, code: string) {
  return postAuth<{ challengeId: string; verified: boolean }>("register/verify", {
    challengeId,
    code,
  });
}

export function authRegisterComplete(input: {
  challengeId: string;
  code: string;
  password: string;
  nickname?: string;
  lang?: string;
}) {
  return postAuth<{
    playerId: string;
    profile: AuthProfileSnap;
    wallet: AuthWalletSnap;
  }>("register/complete", input);
}

export function authLogin(channel: AuthChannel, destination: string, password: string) {
  return postAuth<{
    playerId: string;
    profile: AuthProfileSnap;
    wallet: AuthWalletSnap;
  }>("login", { channel, destination, password });
}

export function authForgotStart(channel: AuthChannel, destination: string) {
  return postAuth<{
    challengeId: string;
    destinationMasked: string;
    expiresAt: string;
    testMode: boolean;
  }>("forgot/start", { channel, destination });
}

export function authForgotVerify(challengeId: string, code: string) {
  return postAuth<{ challengeId: string; verified: boolean }>("forgot/verify", {
    challengeId,
    code,
  });
}

export function authForgotReset(challengeId: string, code: string, password: string) {
  return postAuth<{ ok: boolean; requireRelogin: boolean }>("forgot/reset", {
    challengeId,
    code,
    password,
  });
}

export async function authLogout(): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}
