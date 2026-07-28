import { getDatabase } from "./index";

/** How a given version of a script came to exist. */
export type GenerationKind = "generated" | "revised" | "edited";

export type DraftStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * A script generation, mirrored from the API.
 *
 * "Draft" is the local name for it because that's what it is from the user's
 * side: a script that exists but hasn't been turned into a deck. A generation
 * they abandoned mid-run lands here rather than becoming a card-less deck, and
 * `deckId` being set is what retires it from the drafts list.
 */
export interface ScriptDraft {
  id: string;
  description: string;
  durationMins: number;
  cardCount: number;
  audience: string;
  title: string;
  script: string | null;
  status: DraftStatus;
  error: string | null;
  deckId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVersion {
  id: string;
  generationId: string;
  position: number;
  title: string;
  script: string;
  kind: GenerationKind;
  /** The revise instruction that produced this version, when kind is "revised" —
   *  what lets the history label an entry with what was actually asked for. */
  instruction: string | null;
  createdAt: string;
}

interface DraftRow {
  id: string;
  description: string;
  duration_mins: number;
  card_count: number;
  audience: string;
  title: string;
  script: string | null;
  status: string;
  error: string | null;
  deck_id: string | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  generation_id: string;
  position: number;
  title: string;
  script: string;
  kind: string;
  instruction: string | null;
  created_at: string;
}

function toDraft(row: DraftRow): ScriptDraft {
  return {
    id: row.id,
    description: row.description,
    durationMins: row.duration_mins,
    cardCount: row.card_count,
    audience: row.audience,
    title: row.title,
    script: row.script,
    status: row.status as DraftStatus,
    error: row.error,
    deckId: row.deck_id,
    versionCount: row.version_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): ScriptVersion {
  return {
    id: row.id,
    generationId: row.generation_id,
    position: row.position,
    title: row.title,
    script: row.script,
    kind: row.kind as GenerationKind,
    instruction: row.instruction,
    createdAt: row.created_at,
  };
}

/** What a caller writes in — everything past `id` optional, because the drafts
 *  list and the detail/status endpoints each return a different subset. */
export interface DraftUpsert {
  id: string;
  description?: string | null;
  durationMins?: number | null;
  cardCount?: number | null;
  audience?: string | null;
  title?: string | null;
  script?: string | null;
  status?: string | null;
  error?: string | null;
  deckId?: string | null;
  versionCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Insert or merge a draft.
 *
 * COALESCE on every column for the same reason as upsertDeck: the drafts list
 * returns no `script` (it would be hundreds of KB across a heavy user's
 * history), so a list refresh must not blank the script of a draft already on
 * disk.
 *
 * `error` and `deck_id` are the deliberate exceptions — they're written straight
 * through. Both are meaningful as null: an error that's been cleared by a
 * successful retry has to actually clear, and COALESCE would pin the first
 * failure to the draft forever.
 */
export async function upsertDraft(draft: DraftUpsert): Promise<void> {
  await upsertDrafts([draft]);
}

export async function upsertDrafts(drafts: DraftUpsert[]): Promise<void> {
  if (drafts.length === 0) return;
  const db = await getDatabase();

  const sql = `
    INSERT INTO script_drafts (
      id, description, duration_mins, card_count, audience, title, script,
      status, error, deck_id, version_count, created_at, updated_at, synced_at
    )
    VALUES (?, COALESCE(?, ''), COALESCE(?, 0), COALESCE(?, 0),
            COALESCE(?, 'general'), COALESCE(?, ''), ?, COALESCE(?, 'pending'),
            ?, ?, COALESCE(?, 0), COALESCE(?, ''), COALESCE(?, ''), ?)
    ON CONFLICT (id) DO UPDATE SET
      description   = COALESCE(NULLIF(excluded.description, ''), script_drafts.description),
      duration_mins = COALESCE(NULLIF(excluded.duration_mins, 0), script_drafts.duration_mins),
      card_count    = COALESCE(NULLIF(excluded.card_count, 0), script_drafts.card_count),
      audience      = COALESCE(excluded.audience, script_drafts.audience),
      title         = COALESCE(NULLIF(excluded.title, ''), script_drafts.title),
      script        = COALESCE(excluded.script, script_drafts.script),
      status        = COALESCE(excluded.status, script_drafts.status),
      error         = excluded.error,
      deck_id       = excluded.deck_id,
      version_count = COALESCE(excluded.version_count, script_drafts.version_count),
      created_at    = COALESCE(NULLIF(excluded.created_at, ''), script_drafts.created_at),
      updated_at    = COALESCE(NULLIF(excluded.updated_at, ''), script_drafts.updated_at),
      synced_at     = excluded.synced_at
  `;

  const syncedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const draft of drafts) {
      await db.runAsync(sql, [
        draft.id,
        draft.description ?? null,
        draft.durationMins ?? null,
        draft.cardCount ?? null,
        draft.audience ?? null,
        draft.title ?? null,
        draft.script ?? null,
        draft.status ?? null,
        draft.error ?? null,
        draft.deckId ?? null,
        draft.versionCount ?? null,
        draft.createdAt ?? null,
        draft.updatedAt ?? null,
        syncedAt,
      ]);
    }
  });
}

export async function getDraft(id: string): Promise<ScriptDraft | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DraftRow>(
    "SELECT * FROM script_drafts WHERE id = ?",
    [id],
  );
  return row ? toDraft(row) : null;
}

/** Drafts only — anything with a deck_id has already become a real deck and
 *  belongs in the grid, not in history. */
export async function listDrafts(): Promise<ScriptDraft[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DraftRow>(
    "SELECT * FROM script_drafts WHERE deck_id IS NULL ORDER BY updated_at DESC",
  );
  return rows.map(toDraft);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM script_drafts WHERE id = ?", [id]);
}

/** Remove drafts the server no longer has — called after a full list refresh,
 *  so a draft discarded on another device stops showing up here. */
export async function pruneDraftsNotIn(ids: string[]): Promise<void> {
  const db = await getDatabase();
  if (ids.length === 0) {
    await db.runAsync("DELETE FROM script_drafts WHERE deck_id IS NULL");
    return;
  }
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `DELETE FROM script_drafts WHERE deck_id IS NULL AND id NOT IN (${placeholders})`,
    ids,
  );
}

/**
 * Replace the mirrored version history for a generation.
 *
 * The server's list is authoritative and append-only, so this writes what came
 * back rather than trying to merge: a version can never change once written, and
 * the only way the local copy can differ is by being incomplete.
 */
export async function replaceVersions(
  generationId: string,
  versions: ScriptVersion[],
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM script_versions WHERE generation_id = ?", [
      generationId,
    ]);
    for (const version of versions) {
      await db.runAsync(
        `INSERT INTO script_versions
           (id, generation_id, position, title, script, kind, instruction, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version.id,
          generationId,
          version.position,
          version.title,
          version.script,
          version.kind,
          version.instruction,
          version.createdAt,
        ],
      );
    }
  });
}

/** Oldest first — position order is the order the versions happened in, which is
 *  what an undo/redo cursor steps through. */
export async function listVersions(
  generationId: string,
): Promise<ScriptVersion[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<VersionRow>(
    `SELECT * FROM script_versions WHERE generation_id = ? ORDER BY position ASC`,
    [generationId],
  );
  return rows.map(toVersion);
}
