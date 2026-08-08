/**
 * Player password KDF — Web Crypto PBKDF2-SHA-256 + random salt.
 *
 * Cloudflare Workers cannot load native bcrypt/argon2 modules. PBKDF2-SHA-256
 * with 600_000 iterations (OWASP) is the Workers-safe production KDF used here.
 * Stored format: $pbkdf2-sha256$i=<n>$<saltHex>$<hashHex>
 */

const ITERATIONS = 600_000;
const KEY_LEN = 32;
const SALT_BYTES = 16;

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generatePasswordSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function isValidPassword(password: string): boolean {
  if (typeof password !== "string") return false;
  if (password.length < 8 || password.length > 72) return false;
  // At least one letter and one digit
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

async function pbkdf2(password: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LEN * 8,
  );
  return toHex(bits);
}

export async function hashPlayerPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string; algo: string; encoded: string }> {
  const salt = saltHex ?? generatePasswordSalt();
  const hash = await pbkdf2(password, salt, ITERATIONS);
  const algo = "pbkdf2-sha256";
  const encoded = `$pbkdf2-sha256$i=${ITERATIONS}$${salt}$${hash}`;
  return { hash, salt, algo, encoded };
}

export async function verifyPlayerPassword(
  password: string,
  stored: { passwordHash: string; passwordSalt: string; passwordAlgo?: string },
): Promise<boolean> {
  const algo = stored.passwordAlgo ?? "pbkdf2-sha256";
  if (algo !== "pbkdf2-sha256") return false;

  // Support encoded form in hash column
  if (stored.passwordHash.startsWith("$pbkdf2-sha256$")) {
    const parts = stored.passwordHash.split("$");
    // '', 'pbkdf2-sha256', 'i=N', salt, hash
    if (parts.length < 5) return false;
    const iterPart = parts[2] ?? "";
    const salt = parts[3] ?? "";
    const expect = parts[4] ?? "";
    const iterations = Number(iterPart.replace(/^i=/, ""));
    if (!salt || !expect || !Number.isFinite(iterations) || iterations < 100_000) return false;
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqualHex(actual, expect);
  }

  const actual = await pbkdf2(password, stored.passwordSalt, ITERATIONS);
  return timingSafeEqualHex(actual, stored.passwordHash);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const PLAYER_PASSWORD_ITERATIONS = ITERATIONS;
