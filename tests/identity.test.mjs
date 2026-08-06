import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  handleCreateSession,
  handleGetRound,
  handleSpin,
} from "../lib/api-handlers.ts";
import {
  createProductionIdentityProvider,
  UnconfiguredIdentityProvider,
  IdentityAuthError,
} from "../lib/identity.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
import { createTestDb } from "./db-helper.mjs";
import { TestIdentityProvider } from "./helpers/test-identity-provider.mjs";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function makeRequest(url = "http://localhost/v1/game/sessions", init = {}) {
  return new Request(url, init);
}

function makeAuth(identityProvider, request = makeRequest()) {
  return { identityProvider, request };
}

function makeServices(wallet = new TestWalletAdapter(), roundStore = new TestRoundStore()) {
  return {
    walletAdapter: wallet,
    roundStore,
    allowRealMoney: false,
  };
}

async function seedPlayer(db, playerId, currency, status = "ACTIVE") {
  await db.insert(schema.players).values({
    id: playerId,
    walletAdapterRef: `wallet_${playerId}`,
    currency,
    status,
  });
}

async function parseJson(response) {
  return response.json();
}

test("PlayerIdentity type surface only exposes playerId in identity module source", () => {
  const source = readFileSync(join(repoRoot, "lib/identity.ts"), "utf8");
  assert.match(source, /export type PlayerIdentity\s*=\s*\{\s*playerId:\s*string;\s*\}/);
  assert.doesNotMatch(source, /HeaderIdentityProvider/);
  assert.doesNotMatch(source, /StaticIdentityProvider/);
  assert.doesNotMatch(source, /class\s+\w*Header\w*Identity/);
  assert.doesNotMatch(source, /headers\.get\(/);
  assert.doesNotMatch(source, /request\.headers/);
});

test("production routes wire fail-closed identity and never import test providers", () => {
  const sessionRoute = readFileSync(
    join(repoRoot, "app/api/v1/game/sessions/route.ts"),
    "utf8",
  );
  const spinRoute = readFileSync(join(repoRoot, "app/api/v1/game/spins/route.ts"), "utf8");
  const roundRoute = readFileSync(
    join(repoRoot, "app/api/v1/game/rounds/[roundId]/route.ts"),
    "utf8",
  );
  const handlers = readFileSync(join(repoRoot, "lib/api-handlers.ts"), "utf8");

  for (const source of [sessionRoute, spinRoute, roundRoute]) {
    assert.match(source, /createProductionIdentityProvider/);
    assert.doesNotMatch(source, /from ["'].*lib\/identity/);
    assert.doesNotMatch(source, /test-identity-provider/);
    assert.doesNotMatch(source, /TestIdentityProvider/);
    assert.doesNotMatch(source, /x-player-id/);
    assert.doesNotMatch(source, /x-currency/);
  }

  assert.doesNotMatch(handlers, /test-identity-provider/);
  assert.doesNotMatch(handlers, /TestIdentityProvider/);
  assert.doesNotMatch(handlers, /identityProvider\s*=/);
  assert.match(handlers, /identityProvider:\s*IdentityProvider/);
  assert.match(handlers, /export \{ createProductionIdentityProvider \}/);
});

test("unconfigured production provider fails closed with generic 503", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const provider = createProductionIdentityProvider();
  assert.ok(provider instanceof UnconfiguredIdentityProvider);

  const forged = makeRequest("http://localhost/v1/game/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-player-id": "p1",
      "x-currency": "USD",
    },
  });

  const response = await handleCreateSession(
    db,
    makeAuth(provider, forged),
    { mathVersionId: "ab-math-1.0.0" },
  );
  assert.equal(response.status, 503);
  const body = await parseJson(response);
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(body.error.message, "Service temporarily unavailable");
  assert.doesNotMatch(body.error.message, /Unconfigured|identity|provider|config/i);
});

test("missing identity fails with generic 401", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const response = await handleCreateSession(
    db,
    makeAuth(new TestIdentityProvider(null)),
    { mathVersionId: "ab-math-1.0.0" },
  );
  assert.equal(response.status, 401);
  const body = await parseJson(response);
  assert.equal(body.error.code, "UNAUTHORIZED");
  assert.equal(body.error.message, "Authentication required");
});

test("client-forged playerId/currency body fields are rejected", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "real-player", "USD");
  const auth = makeAuth(new TestIdentityProvider("real-player"));

  const sessionResponse = await handleCreateSession(db, auth, {
    playerId: "attacker",
    currency: "EUR",
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(sessionResponse.status, 400);
  assert.equal((await parseJson(sessionResponse)).error.code, "CLIENT_IDENTITY_REJECTED");

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("real-player", "USD", 10_000);
  const spinResponse = await handleSpin(db, auth, makeServices(wallet), {
    sessionId: "sess_1",
    playerId: "attacker",
    currency: "EUR",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-forged-body",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  });
  assert.equal(spinResponse.status, 400);
  assert.equal((await parseJson(spinResponse)).error.code, "CLIENT_IDENTITY_REJECTED");
});

test("ordinary identity request headers are not trusted", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");

  const headerForged = makeRequest("http://localhost/v1/game/sessions", {
    method: "POST",
    headers: {
      "x-player-id": "p1",
      "x-currency": "USD",
      authorization: "Bearer fake",
    },
  });

  const unconfigured = await handleCreateSession(
    db,
    makeAuth(createProductionIdentityProvider(), headerForged),
    { mathVersionId: "ab-math-1.0.0" },
  );
  assert.equal(unconfigured.status, 503);

  const missingIdentity = await handleCreateSession(
    db,
    makeAuth(new TestIdentityProvider(""), headerForged),
    { mathVersionId: "ab-math-1.0.0" },
  );
  assert.equal(missingIdentity.status, 401);
});

test("test identity provider via DI authenticates and loads currency from DB", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const auth = makeAuth(new TestIdentityProvider("p1"));

  const sessionResponse = await handleCreateSession(db, auth, {
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(sessionResponse.status, 200);
  const sessionBody = await parseJson(sessionResponse);
  assert.ok(sessionBody.sessionId.startsWith("sess_"));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const spinResponse = await handleSpin(db, auth, makeServices(wallet), {
    sessionId: sessionBody.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-di-1",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  });
  assert.equal(spinResponse.status, 200);
  const spinBody = await parseJson(spinResponse);
  assert.equal(spinBody.playerId, "p1");
  assert.equal(spinBody.currency, "USD");
});

test("LOCKED player cannot create session, spin, or read round", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "locked-player", "USD", "LOCKED");
  const auth = makeAuth(new TestIdentityProvider("locked-player"));

  const sessionResponse = await handleCreateSession(db, auth, {
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(sessionResponse.status, 403);
  assert.equal((await parseJson(sessionResponse)).error.code, "PLAYER_UNAVAILABLE");

  const spinResponse = await handleSpin(db, auth, makeServices(), {
    sessionId: "sess_locked",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "locked-spin",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  });
  assert.equal(spinResponse.status, 403);
  assert.equal((await parseJson(spinResponse)).error.code, "PLAYER_UNAVAILABLE");

  const roundResponse = await handleGetRound(db, auth, "any-round");
  assert.equal(roundResponse.status, 403);
  const roundBody = await parseJson(roundResponse);
  assert.equal(roundBody.error.code, "PLAYER_UNAVAILABLE");
  assert.doesNotMatch(roundBody.error.message, /LOCKED|CLOSED/i);
});

test("LOCKED player with unknown mathVersionId still gets 403 PLAYER_UNAVAILABLE", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "locked-math", "USD", "LOCKED");
  const auth = makeAuth(new TestIdentityProvider("locked-math"));
  const response = await handleCreateSession(db, auth, {
    mathVersionId: "unknown-version",
  });
  assert.equal(response.status, 403);
  assert.equal((await parseJson(response)).error.code, "PLAYER_UNAVAILABLE");
});

test("LOCKED player with forged playerId/currency fields still gets 403", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "locked-forge", "USD", "LOCKED");
  const auth = makeAuth(new TestIdentityProvider("locked-forge"));
  const response = await handleCreateSession(db, auth, {
    playerId: "attacker",
    currency: "EUR",
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(response.status, 403);
  assert.equal((await parseJson(response)).error.code, "PLAYER_UNAVAILABLE");
});

test("LOCKED player with outcome fields still gets 403 before CLIENT_OUTCOME_REJECTED", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "locked-outcome", "USD", "LOCKED");
  const auth = makeAuth(new TestIdentityProvider("locked-outcome"));
  const response = await handleSpin(db, auth, makeServices(), {
    sessionId: "sess_locked",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "locked-outcome",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
    grid: [["buffalo"]],
    winscore: 9999,
  });
  assert.equal(response.status, 403);
  assert.equal((await parseJson(response)).error.code, "PLAYER_UNAVAILABLE");
});

test("CLOSED player cannot create session, spin, or read round", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "closed-player", "USD", "CLOSED");
  const auth = makeAuth(new TestIdentityProvider("closed-player"));

  for (const response of [
    await handleCreateSession(db, auth, { mathVersionId: "ab-math-1.0.0" }),
    await handleSpin(db, auth, makeServices(), {
      sessionId: "sess_closed",
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "closed-spin",
      isFreeGame: false,
      freeGamesRemainingBefore: 0,
    }),
    await handleGetRound(db, auth, "any-round"),
  ]) {
    assert.equal(response.status, 403);
    const body = await parseJson(response);
    assert.equal(body.error.code, "PLAYER_UNAVAILABLE");
    assert.doesNotMatch(body.error.message, /LOCKED|CLOSED/i);
  }
});

test("CLOSED player with malformed business params still gets 403", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "closed-malformed", "USD", "CLOSED");
  const auth = makeAuth(new TestIdentityProvider("closed-malformed"));
  const response = await handleSpin(db, auth, makeServices(), {
    sessionId: "",
    roomBase: -1,
    betLevel: "bad",
    betMultiplier: null,
    idempotencyKey: "",
  });
  assert.equal(response.status, 403);
  assert.equal((await parseJson(response)).error.code, "PLAYER_UNAVAILABLE");
});

test("invalid DB currency values are rejected with generic 503", async () => {
  const cases = ["***", "usd", "US "];
  for (let i = 0; i < cases.length; i += 1) {
    const currency = cases[i];
    const { db } = createTestDb();
    const playerId = `bad-currency-${i}`;
    await seedPlayer(db, playerId, currency);
    const auth = makeAuth(new TestIdentityProvider(playerId));
    const response = await handleCreateSession(db, auth, {
      mathVersionId: "ab-math-1.0.0",
    });
    assert.equal(response.status, 503, `currency=${JSON.stringify(currency)}`);
    const body = await parseJson(response);
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
    assert.equal(body.error.message, "Service temporarily unavailable");
    assert.doesNotMatch(JSON.stringify(body), /\*\*\*|usd|US /);
  }
});

test("invalid DB currency with unknown mathVersionId still returns generic 503", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "bad-currency-math", "***");
  const auth = makeAuth(new TestIdentityProvider("bad-currency-math"));
  const response = await handleCreateSession(db, auth, {
    mathVersionId: "unknown-version",
  });
  assert.equal(response.status, 503);
  assert.equal((await parseJson(response)).error.code, "SERVICE_UNAVAILABLE");
});

test("owner can read own valid round; other players get 404", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "owner", "USD");
  await seedPlayer(db, "intruder", "THB");

  const ownerAuth = makeAuth(new TestIdentityProvider("owner"));
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("owner", "USD", 10_000);

  const spinResponse = await handleSpin(db, ownerAuth, makeServices(wallet), {
    sessionId: "sess_owner",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "owned-round",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  });
  assert.equal(spinResponse.status, 200);
  const spinBody = await parseJson(spinResponse);

  const ownerGet = await handleGetRound(db, ownerAuth, spinBody.roundId);
  assert.equal(ownerGet.status, 200);
  assert.equal((await parseJson(ownerGet)).roundId, spinBody.roundId);

  const intruderGet = await handleGetRound(
    db,
    makeAuth(new TestIdentityProvider("intruder")),
    spinBody.roundId,
  );
  assert.equal(intruderGet.status, 404);
  assert.equal((await parseJson(intruderGet)).error.code, "ROUND_NOT_FOUND");
});

test("invalid outcome_json shapes return structured 500 for owner and 404 for others", async () => {
  const shapes = ["null", "[]", "42", "{}"];
  for (let i = 0; i < shapes.length; i += 1) {
    const { db } = createTestDb();
    await seedPlayer(db, "owner", "USD");
    await seedPlayer(db, "intruder", "THB");
    const roundId = `round_bad_shape_${i}`;
    await db.insert(schema.gameRounds).values({
      id: roundId,
      sessionId: "sess_bad_shape",
      playerId: "owner",
      mathVersionId: "ab-math-1.0.0",
      idempotencyKey: `bad-shape-${i}`,
      requestHash: "hash",
      status: "SETTLED",
      currency: "USD",
      totalBetMinor: 50,
      totalWinMinor: 0,
      isFreeGame: false,
      outcomeJson: shapes[i],
    });

    const ownerGet = await handleGetRound(
      db,
      makeAuth(new TestIdentityProvider("owner")),
      roundId,
    );
    assert.equal(ownerGet.status, 500, `shape=${shapes[i]}`);
    assert.equal((await parseJson(ownerGet)).error.code, "INTERNAL_ERROR");

    const intruderGet = await handleGetRound(
      db,
      makeAuth(new TestIdentityProvider("intruder")),
      roundId,
    );
    assert.equal(intruderGet.status, 404, `shape=${shapes[i]}`);
    assert.equal((await parseJson(intruderGet)).error.code, "ROUND_NOT_FOUND");
  }
});

test("outcome_json playerId forgery cannot change authorization", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "owner", "USD");
  await seedPlayer(db, "intruder", "THB");

  const forgedOutcome = {
    roundId: "round_forged_json",
    sessionId: "sess_forged",
    playerId: "intruder",
    mathVersion: "ab-math-1.0.0",
    idempotencyKey: "forged",
    currency: "USD",
    totalBetMinor: 50,
    totalWinMinor: 0,
    balanceAfterMinor: 0,
    isFreeGame: false,
    freeGamesRemaining: 0,
    awardedFreeGames: 0,
    grid: [],
    winningPositions: [],
    lineWins: [],
    scatterCount: 0,
    scatterWin: 0,
    multiplier: 1,
    settledAt: new Date().toISOString(),
  };

  await db.insert(schema.gameRounds).values({
    id: "round_forged_json",
    sessionId: "sess_forged",
    playerId: "owner",
    mathVersionId: "ab-math-1.0.0",
    idempotencyKey: "forged-key",
    requestHash: "hash",
    status: "SETTLED",
    currency: "USD",
    totalBetMinor: 50,
    totalWinMinor: 0,
    isFreeGame: false,
    outcomeJson: JSON.stringify(forgedOutcome),
  });

  const ownerGet = await handleGetRound(
    db,
    makeAuth(new TestIdentityProvider("owner")),
    "round_forged_json",
  );
  assert.notEqual(ownerGet.status, 200);
  assert.equal(ownerGet.status, 500);
  assert.equal((await parseJson(ownerGet)).error.code, "INTERNAL_ERROR");

  const intruderGet = await handleGetRound(
    db,
    makeAuth(new TestIdentityProvider("intruder")),
    "round_forged_json",
  );
  assert.notEqual(intruderGet.status, 200);
  assert.equal(intruderGet.status, 404);
  assert.equal((await parseJson(intruderGet)).error.code, "ROUND_NOT_FOUND");
});

test("get round without identity fails closed", async () => {
  const { db } = createTestDb();
  const response = await handleGetRound(
    db,
    makeAuth(createProductionIdentityProvider()),
    "any-round",
  );
  assert.equal(response.status, 503);

  const missing = await handleGetRound(db, makeAuth(new TestIdentityProvider(null)), "any-round");
  assert.equal(missing.status, 401);
});

test("IdentityAuthError is thrown by empty test provider", async () => {
  await assert.rejects(
    () => new TestIdentityProvider("").resolve(makeRequest()),
    (error) => error instanceof IdentityAuthError && error.statusCode === 401,
  );
});

test("DB authorization ignores forged outcome_json for non-owner even if JSON claims them", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "owner", "USD");
  await seedPlayer(db, "intruder", "THB");

  // Sanity: update an owned round's outcome to claim intruder — owner still hits integrity path.
  await seedPlayer(db, "owner2", "USD");
  const owner2Auth = makeAuth(new TestIdentityProvider("owner2"));
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("owner2", "USD", 10_000);
  const spin = await handleSpin(db, owner2Auth, makeServices(wallet), {
    sessionId: "sess_owner2",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "owner2-round",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  });
  const body = await parseJson(spin);
  const tampered = { ...body, playerId: "intruder" };
  await db
    .update(schema.gameRounds)
    .set({ outcomeJson: JSON.stringify(tampered) })
    .where(eq(schema.gameRounds.id, body.roundId));

  const ownerRead = await handleGetRound(db, owner2Auth, body.roundId);
  assert.equal(ownerRead.status, 500);
  const intruderRead = await handleGetRound(
    db,
    makeAuth(new TestIdentityProvider("intruder")),
    body.roundId,
  );
  assert.equal(intruderRead.status, 404);
});
