/**
 * Server-side player identity resolution.
 *
 * Production must fail closed until a formal authentication system is wired.
 * Client-supplied identity from request bodies, query strings, cookies, or
 * ordinary custom headers is never trusted by this module.
 */

export type PlayerIdentity = {
  playerId: string;
};

export class IdentityAuthError extends Error {
  readonly statusCode = 401 as const;

  constructor() {
    super("Authentication required");
    this.name = "IdentityAuthError";
  }
}

export class IdentityUnavailableError extends Error {
  readonly statusCode = 503 as const;

  constructor() {
    super("Service temporarily unavailable");
    this.name = "IdentityUnavailableError";
  }
}

export interface IdentityProvider {
  /**
   * Resolve the authenticated player for this request.
   * Must throw IdentityAuthError when credentials are missing/invalid.
   * Must throw IdentityUnavailableError when the identity system is not configured.
   */
  resolve(request: Request): Promise<PlayerIdentity>;
}

/**
 * Fail-closed production provider used when formal authentication is not wired.
 * Does not inspect headers, cookies, query parameters, or body fields.
 */
export class UnconfiguredIdentityProvider implements IdentityProvider {
  async resolve(): Promise<PlayerIdentity> {
    throw new IdentityUnavailableError();
  }
}

export function createProductionIdentityProvider(): IdentityProvider {
  return new UnconfiguredIdentityProvider();
}
