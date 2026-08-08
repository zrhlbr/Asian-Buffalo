import assert from "node:assert/strict";
import test from "node:test";
import { assertLobbyI18nComplete, lobbyKeys } from "../client/xi-lobby/i18n.ts";

test("auth + lobby i18n zh/en/my key parity", () => {
  const result = assertLobbyI18nComplete();
  assert.equal(result.ok, true, result.missing.slice(0, 20).join(", "));
  const keys = lobbyKeys();
  for (const required of [
    "auth.title.login",
    "auth.title.register",
    "auth.title.forgot",
    "auth.tab.phone",
    "auth.tab.email",
    "auth.error.INVALID_CREDENTIALS",
    "auth.error.PROVIDER_NOT_CONFIGURED",
    "lobby.auth.login",
    "lobby.auth.register",
    "lobby.auth.logout",
  ]) {
    assert.ok(keys.includes(required), `missing ${required}`);
  }
});
