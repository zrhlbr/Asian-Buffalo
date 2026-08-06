/**
 * Atomic multi-statement execution for SQLite drivers.
 *
 * Driver detection (never use `$client.exec` — D1 also has exec):
 * - D1: `db.$client.batch` — NO BEGIN/COMMIT/ROLLBACK
 * - better-sqlite3: `db.$client.transaction` — sync native transaction
 *
 * D1 does not support interactive BEGIN/COMMIT callback transactions.
 */

export type AtomicStatement = {
  sql: string;
  params?: unknown[];
};

export type SqliteDriverKind = "d1" | "better-sqlite3";

export type AtomicDb = {
  batch?: (queries: unknown[]) => Promise<unknown[]>;
  $client?: {
    batch?: (
      statements: unknown[],
    ) => Promise<Array<{ success?: boolean; meta?: { changes?: number }; results?: unknown }>>;
    prepare?: (sql: string) => {
      bind: (...params: unknown[]) => unknown;
      run: (...params: unknown[]) => { changes: number };
    };
    transaction?: (fn: () => unknown) => () => unknown;
    exec?: (sql: string) => unknown;
  };
};

export function detectSqliteDriver(db: AtomicDb): SqliteDriverKind {
  // D1Database exposes batch; better-sqlite3 does not.
  if (typeof db.$client?.batch === "function") {
    return "d1";
  }
  // Drizzle D1 wrapper also exposes batch even if $client shape differs.
  if (typeof db.batch === "function" && typeof db.$client?.transaction !== "function") {
    return "d1";
  }
  // better-sqlite3 Database exposes transaction(fn) factory and has no batch.
  if (typeof db.$client?.transaction === "function") {
    return "better-sqlite3";
  }
  throw new Error(
    "Unsupported SQLite driver: expected D1 ($client.batch) or better-sqlite3 ($client.transaction)",
  );
}

export type AtomicBatchResult = {
  changes: number[];
  driver: SqliteDriverKind;
};

/**
 * Run statements as one atomic unit.
 * - D1: `D1Database.batch` (rolls back all on any failure)
 * - better-sqlite3: native `transaction()` (sync)
 */
export async function runAtomicBatch(
  db: AtomicDb,
  statements: AtomicStatement[],
): Promise<AtomicBatchResult> {
  if (statements.length === 0) {
    return { changes: [], driver: detectSqliteDriver(db) };
  }

  const driver = detectSqliteDriver(db);
  const client = db.$client;
  if (!client) {
    throw new Error("Database $client is required for atomic batch execution");
  }

  if (driver === "d1") {
    if (typeof client.batch !== "function" || typeof client.prepare !== "function") {
      throw new Error("D1 client missing batch/prepare");
    }
    const prepared = statements.map((stmt) => {
      const ps = client.prepare!(stmt.sql);
      return stmt.params && stmt.params.length > 0 ? ps.bind(...stmt.params) : ps.bind();
    });
    const results = await client.batch!(prepared);
    const changes = results.map((row) => {
      const metaChanges = row?.meta?.changes;
      if (typeof metaChanges === "number") return metaChanges;
      return 0;
    });
    return { changes, driver };
  }

  // better-sqlite3 — never use async callback transactions / BEGIN via exec
  if (typeof client.transaction !== "function" || typeof client.prepare !== "function") {
    throw new Error("better-sqlite3 client missing transaction/prepare");
  }
  const runTx = client.transaction(() => {
    const changes: number[] = [];
    for (const stmt of statements) {
      const info = client.prepare!(stmt.sql).run(...(stmt.params ?? []));
      changes.push(info.changes);
    }
    return changes;
  });
  const changes = runTx() as number[];
  return { changes, driver };
}

/** Abort the current atomic batch (forces full rollback). For fault-injection tests. */
export function atomicAbortStatement(): AtomicStatement {
  return {
    sql: "SELECT 1 FROM __ab_atomic_fault_rollback_marker WHERE 1 = 0",
    params: [],
  };
}
