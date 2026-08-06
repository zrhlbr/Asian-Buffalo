/**
 * Test-only identity provider. Must never be imported from production source.
 * Inject explicitly into handlers under test.
 */

import {
  IdentityAuthError,
  IdentityUnavailableError,
} from "../../lib/identity.ts";

export class TestIdentityProvider {
  /**
   * @param {string | null | undefined} playerId
   *   - string: authenticated player
   *   - null/undefined/"": missing/invalid credentials → IdentityAuthError
   */
  constructor(playerId) {
    this.playerId = playerId;
  }

  async resolve() {
    if (typeof this.playerId !== "string" || this.playerId.length === 0) {
      throw new IdentityAuthError();
    }
    return { playerId: this.playerId };
  }
}

export { IdentityAuthError, IdentityUnavailableError };
