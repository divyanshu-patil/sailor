import { getDatabase } from "./index";
import { DeckItem } from "@/types/presentation/deck";

/** A row exactly as it comes back from SQLite. */
interface DeckRow {
  id: string;
  title: string;
  description: string;
  script: string | null;
  color: string;
  duration_mins: number;
  card_count: number;
  is_favourite: number;
  generation_status: string | null;
  cards_generation_status: string | null;
  is_public: number | null;
  tags: string | null;
  category: string | null;
  practice_count: number | null;
  save_count: number | null;
  created_at: string;
  updated_at: string;
}

/** What the app writes in — every field beyond `id` optional, because the list
 *  endpoint and the detail endpoint each return a different subset. */
export interface DeckUpsert {
  id: string;
  title?: string | null;
  description?: string | null;
  script?: string | null;
  color?: string | null;
  durationMins?: number | null;
  slideCount?: number | null;
  isFavourite?: boolean | null;
  generationStatus?: string | null;
  cardsGenerationStatus?: string | null;
  isPublic?: boolean | null;
  /** Written as JSON. Null leaves whatever is stored alone, same as every other
   *  optional field here — the list endpoint doesn't return tags. */
  tags?: string[] | null;
  category?: string | null;
  practiceCount?: number | null;
  saveCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type DeckSortOption =
  | "dateCreated"
  | "nameAsc"
  | "nameDesc"
  | "duration"
  | "cardCount";

/**
 * Whitelist, not interpolation of caller input.
 *
 * `dateCreated` sorts on updated_at rather than created_at deliberately: the
 * grid is a "what have I been working on" list, and a deck you revised this
 * morning belongs at the top even if you created it last month.
 */
const ORDER_BY: Record<DeckSortOption, string> = {
  dateCreated: "d.updated_at DESC",
  nameAsc: "d.title COLLATE NOCASE ASC",
  nameDesc: "d.title COLLATE NOCASE DESC",
  duration: "d.duration_mins DESC",
  cardCount: "d.card_count DESC",
};

const DECK_COLUMNS = `
  d.id, d.title, d.description, d.script, d.color,
  d.duration_mins, d.card_count, d.is_favourite,
  d.generation_status, d.cards_generation_status,
  d.is_public, d.tags, d.category, d.practice_count, d.save_count,
  d.created_at, d.updated_at
`;

function toDeckItem(row: DeckRow): DeckItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    color: row.color,
    updatedAt: row.updated_at,
    slideCount: row.card_count,
    durationMins: row.duration_mins,
    isFavourite: row.is_favourite === 1,
    isPublic: row.is_public === 1,
    // Stored as JSON text; a row written before V3 (or by a payload with no
    // tags) has the '[]' default, so this never throws in practice — but a
    // corrupt value shouldn't take the whole deck grid down with it.
    tags: parseTags(row.tags),
    category: row.category,
    practiceCount: row.practice_count ?? 0,
    saveCount: row.save_count ?? 0,
  };
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Insert or merge a deck.
 *
 * COALESCE on every column is the whole point. `GET /decks` returns a summary
 * with no script; `GET /decks/{id}` returns the script. Without COALESCE, a
 * refresh of the deck list would blank the script of every deck already on disk
 * — so a field that wasn't in the payload keeps whatever is already stored,
 * rather than overwriting it with null.
 */
export async function upsertDeck(deck: DeckUpsert): Promise<void> {
  await upsertDecks([deck]);
}

export async function upsertDecks(decks: DeckUpsert[]): Promise<void> {
  if (decks.length === 0) return;
  const db = await getDatabase();

  const sql = `
    INSERT INTO decks (
      id, title, description, script, color, duration_mins, card_count,
      is_favourite, generation_status, cards_generation_status,
      is_public, tags, category, practice_count, save_count,
      created_at, updated_at, synced_at
    )
    VALUES (?, COALESCE(?, ''), COALESCE(?, ''), ?, COALESCE(?, '#A1AFDE'),
            COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), ?, ?,
            ?, ?, ?, ?, ?,
            COALESCE(?, ''), COALESCE(?, ''), ?)
    ON CONFLICT (id) DO UPDATE SET
      title                   = COALESCE(excluded.title, decks.title),
      description             = COALESCE(NULLIF(excluded.description, ''), decks.description),
      script                  = COALESCE(excluded.script, decks.script),
      color                   = COALESCE(excluded.color, decks.color),
      duration_mins           = COALESCE(excluded.duration_mins, decks.duration_mins),
      card_count              = COALESCE(excluded.card_count, decks.card_count),
      is_favourite            = COALESCE(excluded.is_favourite, decks.is_favourite),
      generation_status       = COALESCE(excluded.generation_status, decks.generation_status),
      cards_generation_status = COALESCE(excluded.cards_generation_status, decks.cards_generation_status),
      is_public               = COALESCE(excluded.is_public, decks.is_public),
      tags                    = COALESCE(NULLIF(excluded.tags, '[]'), decks.tags),
      category                = COALESCE(excluded.category, decks.category),
      practice_count          = COALESCE(excluded.practice_count, decks.practice_count),
      save_count              = COALESCE(excluded.save_count, decks.save_count),
      created_at              = COALESCE(NULLIF(excluded.created_at, ''), decks.created_at),
      updated_at              = COALESCE(NULLIF(excluded.updated_at, ''), decks.updated_at),
      synced_at               = excluded.synced_at
  `;

  const syncedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const deck of decks) {
      await db.runAsync(sql, [
        deck.id,
        deck.title ?? null,
        deck.description ?? null,
        deck.script ?? null,
        deck.color ?? null,
        deck.durationMins ?? null,
        deck.slideCount ?? null,
        deck.isFavourite == null ? null : deck.isFavourite ? 1 : 0,
        deck.generationStatus ?? null,
        deck.cardsGenerationStatus ?? null,
        deck.isPublic == null ? null : deck.isPublic ? 1 : 0,
        deck.tags == null ? null : JSON.stringify(deck.tags),
        deck.category ?? null,
        deck.practiceCount ?? null,
        deck.saveCount ?? null,
        deck.createdAt ?? null,
        deck.updatedAt ?? null,
        syncedAt,
      ]);
    }
  });
}

export async function listDecks(
  sort: DeckSortOption = "dateCreated",
  filter: "all" | "favourites" = "all",
): Promise<DeckItem[]> {
  const db = await getDatabase();
  const where = filter === "favourites" ? "WHERE d.is_favourite = 1" : "";
  const rows = await db.getAllAsync<DeckRow>(
    `SELECT ${DECK_COLUMNS} FROM decks d ${where} ORDER BY ${ORDER_BY[sort]}`,
  );
  return rows.map(toDeckItem);
}

export async function getDeck(id: string): Promise<DeckItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DeckRow>(
    `SELECT ${DECK_COLUMNS} FROM decks d WHERE d.id = ?`,
    [id],
  );
  return row ? toDeckItem(row) : null;
}

/** The script isn't on DeckItem — the screens that need it ask for it directly. */
export async function getDeckScript(id: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ script: string | null }>(
    "SELECT script FROM decks WHERE id = ?",
    [id],
  );
  return row?.script ?? null;
}

export async function setDeckScript(
  id: string,
  script: string,
  title?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE decks
        SET script = ?,
            title = COALESCE(NULLIF(?, ''), title),
            updated_at = ?
      WHERE id = ?`,
    [script, title ?? "", new Date().toISOString(), id],
  );
}

/**
 * Flip the favourite flag locally and hand back the value that was written.
 *
 * Returning the new value rather than taking one is what makes the optimistic
 * toggle safe against double-taps: the DB row is the single arbiter of what
 * "toggled" means, so two taps in flight can't both read `false` and both
 * write `true`.
 */
export async function toggleDeckFavourite(id: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ is_favourite: number }>(
    `UPDATE decks SET is_favourite = 1 - is_favourite WHERE id = ?
     RETURNING is_favourite`,
    [id],
  );
  return row?.is_favourite === 1;
}

export async function setDeckFavourite(
  id: string,
  isFavourite: boolean,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE decks SET is_favourite = ? WHERE id = ?", [
    isFavourite ? 1 : 0,
    id,
  ]);
}

export async function deleteDeck(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM decks WHERE id = ?", [id]);
}

/**
 * Remove decks the server no longer has.
 *
 * Called after a full list refresh: anything on disk that wasn't in the payload
 * was deleted on another device, and without this it would sit in the grid
 * forever, since nothing else ever removes it.
 */
export async function pruneDecksNotIn(ids: string[]): Promise<void> {
  const db = await getDatabase();
  if (ids.length === 0) {
    await db.runAsync("DELETE FROM decks");
    return;
  }
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `DELETE FROM decks WHERE id NOT IN (${placeholders})`,
    ids,
  );
}

export type DeckMatchType = "title" | "description" | "script" | "card";

export interface DeckSearchResult extends DeckItem {
  matchType: DeckMatchType;
}

const MATCH_TYPE_BY_RANK: Record<number, DeckMatchType> = {
  1: "title",
  2: "description",
  3: "script",
  4: "card",
};

/**
 * LIKE treats % and _ as wildcards, so a user searching for "50%" would
 * otherwise match everything. Escaping them (and the escape character itself,
 * first) with an explicit ESCAPE clause makes the query mean what was typed.
 */
function likePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

/**
 * Ranked search across a deck and its cards.
 *
 * Title beats description beats script beats card title — a deck whose *name* is
 * what you typed is almost always the one you meant, and a deck that merely
 * mentions the word somewhere in a 2000-word script is the weakest kind of hit.
 *
 * One query rather than four: the UNION collects every candidate with its rank,
 * MIN(rank) per deck collapses a deck that matched several ways down to its
 * strongest match, and the join brings back the full row. Doing this as four
 * separate queries in JS would mean de-duplicating by hand and reading the whole
 * decks table into memory to do it.
 */
export async function searchDecks(
  query: string,
  sort: DeckSortOption = "dateCreated",
): Promise<DeckSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = await getDatabase();
  const pattern = likePattern(trimmed);

  const rows = await db.getAllAsync<DeckRow & { match_rank: number }>(
    `
    WITH matches AS (
      SELECT id AS deck_id, 1 AS rank FROM decks
       WHERE title LIKE ? ESCAPE '\\'
      UNION ALL
      SELECT id, 2 FROM decks
       WHERE description LIKE ? ESCAPE '\\'
      UNION ALL
      SELECT id, 3 FROM decks
       WHERE script IS NOT NULL AND script LIKE ? ESCAPE '\\'
      UNION ALL
      SELECT DISTINCT deck_id, 4 FROM cards
       WHERE title LIKE ? ESCAPE '\\'
    ),
    best AS (
      SELECT deck_id, MIN(rank) AS rank FROM matches GROUP BY deck_id
    )
    SELECT ${DECK_COLUMNS}, b.rank AS match_rank
      FROM decks d
      JOIN best b ON b.deck_id = d.id
     ORDER BY b.rank ASC, ${ORDER_BY[sort]}
    `,
    [pattern, pattern, pattern, pattern],
  );

  return rows.map((row) => ({
    ...toDeckItem(row),
    // The query only ever produces ranks 1-4; the fallback satisfies types.
    /* v8 ignore next */
    matchType: MATCH_TYPE_BY_RANK[row.match_rank] ?? "title",
  }));
}
