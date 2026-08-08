/**
 * OTP delivery provider interfaces + stub adapters.
 *
 * SK SMS device adapter and SMTP email adapter are NOT_PRODUCTION_READY.
 * Production without live config OR test mode → fail-closed.
 *
 * Test mode (`AB_AUTH_OTP_TEST_MODE=1`): does not send; caller accepts fixed OTP.
 * Never hardcodes production API keys / SMTP passwords.
 */

export type OtpChannel = "sms" | "email";

export type OtpSendResult =
  | { ok: true; provider: string; mode: "test" | "live-stub" }
  | { ok: false; code: string; message: string };

export interface OtpSmsProvider {
  readonly name: string;
  sendSms(toE164: string, body: string): Promise<OtpSendResult>;
}

export interface OtpEmailProvider {
  readonly name: string;
  sendEmail(to: string, subject: string, body: string): Promise<OtpSendResult>;
}

function readEnv(name: string): string | undefined {
  try {
    const v = process.env[name];
    if (typeof v === "string" && v.length > 0) return v;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Fixed OTP accepted only when AB_AUTH_OTP_TEST_MODE=1. Documented; not a secret. */
export const AUTH_OTP_TEST_CODE = "123456";

export function isAuthOtpTestMode(): boolean {
  return readEnv("AB_AUTH_OTP_TEST_MODE") === "1";
}

/**
 * SK SMS device stub — NOT_PRODUCTION_READY.
 * Live path requires AB_SK_SMS_ENDPOINT + AB_SK_SMS_API_KEY (never shipped hardcoded).
 * Without credentials and without test mode → fail-closed.
 */
export class SkSmsDeviceStubAdapter implements OtpSmsProvider {
  readonly name = "sk-sms-device-stub";

  async sendSms(toE164: string, body: string): Promise<OtpSendResult> {
    void body;
    if (isAuthOtpTestMode()) {
      return { ok: true, provider: this.name, mode: "test" };
    }
    const endpoint = readEnv("AB_SK_SMS_ENDPOINT");
    const apiKey = readEnv("AB_SK_SMS_API_KEY");
    if (!endpoint || !apiKey) {
      return {
        ok: false,
        code: "PROVIDER_NOT_CONFIGURED",
        message: "SK SMS provider not configured (NOT_PRODUCTION_READY stub)",
      };
    }
    // Stub: refuse live send even if env present — device integration not wired.
    void toE164;
    return {
      ok: false,
      code: "PROVIDER_NOT_PRODUCTION_READY",
      message: "SK SMS stub refuses live send until device integration is approved",
    };
  }
}

/**
 * SMTP stub — NOT_PRODUCTION_READY.
 * Live path would need AB_SMTP_HOST / AB_SMTP_USER / AB_SMTP_PASS (never hardcoded).
 */
export class SmtpEmailStubAdapter implements OtpEmailProvider {
  readonly name = "smtp-email-stub";

  async sendEmail(to: string, subject: string, body: string): Promise<OtpSendResult> {
    void subject;
    void body;
    if (isAuthOtpTestMode()) {
      return { ok: true, provider: this.name, mode: "test" };
    }
    const host = readEnv("AB_SMTP_HOST");
    const user = readEnv("AB_SMTP_USER");
    const pass = readEnv("AB_SMTP_PASS");
    if (!host || !user || !pass) {
      return {
        ok: false,
        code: "PROVIDER_NOT_CONFIGURED",
        message: "SMTP provider not configured (NOT_PRODUCTION_READY stub)",
      };
    }
    void to;
    return {
      ok: false,
      code: "PROVIDER_NOT_PRODUCTION_READY",
      message: "SMTP stub refuses live send until mailer integration is approved",
    };
  }
}

export function createDefaultSmsProvider(): OtpSmsProvider {
  return new SkSmsDeviceStubAdapter();
}

export function createDefaultEmailProvider(): OtpEmailProvider {
  return new SmtpEmailStubAdapter();
}
