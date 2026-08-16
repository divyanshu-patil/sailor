/**
 * Local schema for the offline mirror.
 *
 * The API is still the source of truth for *writes*; this is the source of truth
 * for what the UI renders. Hooks call a service, then write what came back into
 * these tables, and the screens read from here — so a cold start paints from disk
 * instead of a spinner, and search is a real query rather than a filter over
 * whatever happened to be in memory.
 *
 * Adding a migration: append one SQL string to MIGRATIONS and leave the existing
 * entries untouched. The array index *is* the version number, so reordering or
 * editing a shipped entry silently skips it on devices that already ran it.
 */

/** Tables the change-listener fans out on. Keep in sync with the DDL below. */
export const TABLES = {
  decks: "decks",
  cards: "cards",
  scriptDrafts: "script_drafts",
  scriptVersions: "script_versions",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * Timestamps are stored as ISO-8601 strings throughout, never epoch numbers.
 * That's what the API already sends, and ISO-8601 sorts lexicographically in the
 * same order it sorts chronologically — so `ORDER BY updated_at DESC` is correct
 * with no conversion on either side of the boundary.
 *
 * Booleans are 0/1 INTEGERs, SQLite having no boolean type.
 *
 * COLLATE NOCASE on the searchable text columns is what makes the search in
 * decks.repo case-insensitive without wrapping every column in LOWER(), which
 * would make the indexes unusable.
 */
const V1 = `
CREATE TABLE IF NOT EXISTS decks (
  id                      TEXT PRIMARY KEY NOT NULL,
  title                   TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  description             TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  script                  TEXT COLLATE NOCASE,
  color                   TEXT NOT NULL DEFAULT '#A1AFDE',
  duration_mins           INTEGER NOT NULL DEFAULT 0,
  card_count              INTEGER NOT NULL DEFAULT 0,
  is_favourite            INTEGER NOT NULL DEFAULT 0,
  generation_status       TEXT,
  cards_generation_status TEXT,
  created_at              TEXT NOT NULL DEFAULT '',
  updated_at              TEXT NOT NULL DEFAULT '',
  synced_at               TEXT
);

CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decks_favourite  ON decks (is_favourite, updated_at DESC);

CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY NOT NULL,
  deck_id     TEXT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  keywords    TEXT NOT NULL DEFAULT '[]',
  color       TEXT NOT NULL DEFAULT '#C9E4DE',
  impact      REAL NOT NULL DEFAULT 0,
  delivery    TEXT NOT NULL DEFAULT 'explaining',
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT,
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_position ON cards (deck_id, position);

-- Every version of a deck's script, oldest first. Written on generation, on an
-- AI revision, and on a manual edit, which is what lets the preview screen offer
-- undo/redo across generations instead of the newest script being the only one
-- that survives.
CREATE TABLE IF NOT EXISTS script_generations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id     TEXT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  script      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  instruction TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_script_generations_deck ON script_generations (deck_id, id);
`;

/**
 * Script generation stopped being a deck's property.
 *
 * A script is now generated against a `ScriptGeneration` on the API and only
 * becomes a deck once the user accepts it, so the local mirror needs somewhere
 * to keep a script that has no deck — which V1's deck_id-keyed history table
 * could not represent. `script_drafts` is that place: an unfinished or
 * unaccepted generation lives there and shows up as history, instead of the old
 * behaviour where every abandoned run left a card-less deck in the grid.
 *
 * The V1 history table is dropped rather than migrated. It was never written to
 * (nothing ever called into it), so there is no user data in it to preserve, and
 * carrying a deck-keyed history alongside a generation-keyed one would leave two
 * tables answering the same question differently.
 */
const V2 = `
DROP TABLE IF EXISTS script_generations;

CREATE TABLE IF NOT EXISTS script_drafts (
  id            TEXT PRIMARY KEY NOT NULL,
  description   TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  duration_mins INTEGER NOT NULL DEFAULT 0,
  card_count    INTEGER NOT NULL DEFAULT 0,
  audience      TEXT NOT NULL DEFAULT 'general',
  title         TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  script        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  error         TEXT,
  -- Non-null once the draft was accepted and became a deck. This is what
  -- separates "still a draft" from "already a deck", so the drafts list filters
  -- on it rather than on status.
  deck_id       TEXT,
  version_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT '',
  synced_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_script_drafts_updated ON script_drafts (deck_id, updated_at DESC);

-- The undo/redo stack. Append-only and mirrored from the API, so stepping back
-- through revisions works from disk without a round trip per tap.
CREATE TABLE IF NOT EXISTS script_versions (
  id            TEXT PRIMARY KEY NOT NULL,
  generation_id TEXT NOT NULL REFERENCES script_drafts (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  script        TEXT NOT NULL,
  kind          TEXT NOT NULL,
  instruction   TEXT,
  created_at    TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_script_versions_position
  ON script_versions (generation_id, position);
`;

/**
 * Publish state, mirrored so the deck detail screen's menu can say "Publish" or
 * "Unpublish" on the first frame — before the API refresh lands, and at all on
 * a cold start with no network.
 *
 * `tags` is a JSON array in a TEXT column rather than a join table: nothing
 * queries by tag locally (tag filtering is a server concern, on the feed), so a
 * second table would only buy joins nobody makes.
 *
 * All four are nullable with no default, unlike the V1 columns. That's what
 * makes the upsert's COALESCE work: `GET /decks` returns none of them, so a
 * grid refresh has to leave them alone — and it can only tell "not sent" from
 * "sent as false" if an absent value stays NULL instead of being defaulted to 0
 * on the way in. A NULL here means "never fetched the detail", which reads as
 * not-public, no tags, no category.
 */
const V3 = `
ALTER TABLE decks ADD COLUMN is_public      INTEGER;
ALTER TABLE decks ADD COLUMN tags           TEXT;
ALTER TABLE decks ADD COLUMN category       TEXT;
ALTER TABLE decks ADD COLUMN practice_count INTEGER;
`;

export const MIGRATIONS: readonly string[] = [V1, V2, V3];

/** Target version — always the number of migrations. */
export const SCHEMA_VERSION = MIGRATIONS.length;
