import * as SQLite from "expo-sqlite";
import { MIGRATIONS, TableName } from "./schema";

const DATABASE_NAME = "sailor.db";

/**
 * One connection for the whole app, opened lazily.
 *
 * Held as the *promise* rather than the resolved handle so that concurrent
 * first-callers — several hooks mounting in the same commit is the normal case —
 * all await the same open + migrate instead of racing to run the migrations
 * twice.
 */
let connection: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    // Required for addDatabaseChangeListener below — without it the repos write
    // happily but nothing re-renders.
    enableChangeListener: true,
  });

  // WAL lets a read run while a write is in flight, which matters here because
  // the poller writes on a timer while the user is scrolling a list that reads.
  // foreign_keys is off by default in SQLite and has to be set per connection —
  // without it the ON DELETE CASCADE on cards/script_versions is decorative.
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;

  if (current >= MIGRATIONS.length) return;

  for (let version = current; version < MIGRATIONS.length; version++) {
    // Each migration is its own transaction: if v3 fails, v1 and v2 stay
    // applied and user_version reflects that, so the next launch resumes at v3
    // rather than replaying everything.
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      // PRAGMA doesn't accept bound parameters, hence the interpolation — safe
      // because `version` is a loop counter over a module constant.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** The shared handle. Every repo call goes through this. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  connection ??= open();
  return connection;
}

/**
 * Subscribe to writes on specific tables.
 *
 * expo-sqlite reports one event per changed row, so a 40-card insert fires 40
 * times. Callbacks are therefore coalesced onto a microtask: a caller that
 * re-queries on every notification would otherwise re-run its SELECT 40 times
 * for a single logical change.
 *
 * Returns an unsubscribe function — call it from an effect cleanup.
 */
export function subscribeToTables(
  tables: readonly TableName[],
  onChange: () => void,
): () => void {
  const watched = new Set<string>(tables);
  let queued = false;

  const subscription = SQLite.addDatabaseChangeListener(({ tableName }) => {
    if (!watched.has(tableName) || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      onChange();
    });
  });

  return () => subscription.remove();
}

/**
 * Drop everything. Used on sign-out — the mirror is per-account, and leaving one
 * user's decks on disk for the next one to read is a data leak, not a cache hit.
 */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Ordered child-first so the delete works whether or not foreign_keys is on.
    await db.execAsync(
      "DELETE FROM script_versions; DELETE FROM script_drafts; " +
        "DELETE FROM cards; DELETE FROM decks;",
    );
  });
}

export { TABLES } from "./schema";
export type { TableName } from "./schema";
