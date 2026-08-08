/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Explicit only — never defaulted on by this worker. */
  AB_ALLOW_TEST_IDENTITY?: string;
  AB_TEST_PLAYER_ID?: string;
  AB_FORCE_FAIL_CLOSED_IDENTITY?: string;
  /** Auth OTP test mode — fixed code only; never enables live SMS/SMTP. */
  AB_AUTH_OTP_TEST_MODE?: string;
  AB_SK_SMS_ENDPOINT?: string;
  AB_SK_SMS_API_KEY?: string;
  AB_SMTP_HOST?: string;
  AB_SMTP_USER?: string;
  AB_SMTP_PASS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

/**
 * Minimal bridge: Cloudflare/Miniflare bindings → process.env so
 * `AB_ALLOW_TEST_IDENTITY` is visible to runtime-identity.
 * Does not invent defaults; unset bindings stay unset (fail-closed).
 */
function bridgeExplicitIdentityEnv(env: Env): void {
  if (typeof process === "undefined" || !process.env) return;
  if (env.AB_ALLOW_TEST_IDENTITY !== undefined) {
    process.env.AB_ALLOW_TEST_IDENTITY = env.AB_ALLOW_TEST_IDENTITY;
  }
  if (env.AB_TEST_PLAYER_ID !== undefined) {
    process.env.AB_TEST_PLAYER_ID = env.AB_TEST_PLAYER_ID;
  }
  if (env.AB_FORCE_FAIL_CLOSED_IDENTITY !== undefined) {
    process.env.AB_FORCE_FAIL_CLOSED_IDENTITY = env.AB_FORCE_FAIL_CLOSED_IDENTITY;
  }
  if (env.AB_AUTH_OTP_TEST_MODE !== undefined) {
    process.env.AB_AUTH_OTP_TEST_MODE = env.AB_AUTH_OTP_TEST_MODE;
  }
  if (env.AB_SK_SMS_ENDPOINT !== undefined) {
    process.env.AB_SK_SMS_ENDPOINT = env.AB_SK_SMS_ENDPOINT;
  }
  if (env.AB_SK_SMS_API_KEY !== undefined) {
    process.env.AB_SK_SMS_API_KEY = env.AB_SK_SMS_API_KEY;
  }
  if (env.AB_SMTP_HOST !== undefined) {
    process.env.AB_SMTP_HOST = env.AB_SMTP_HOST;
  }
  if (env.AB_SMTP_USER !== undefined) {
    process.env.AB_SMTP_USER = env.AB_SMTP_USER;
  }
  if (env.AB_SMTP_PASS !== undefined) {
    process.env.AB_SMTP_PASS = env.AB_SMTP_PASS;
  }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    bridgeExplicitIdentityEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
