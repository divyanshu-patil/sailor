import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * expo-sqlite over node's own SQLite, so the repos' SQL — the migrations, the
 * COALESCE merges, the ranked search — runs against a real engine rather than
 * a stub that would accept anything. One database per name, like a file, so a
 * reopen sees what the last connection wrote.
 */
const sqlite = vi.hoisted(() => ({
  listeners: new Set<(event: { tableName?: string }) => void>(),
  files: new Map<string, unknown>(),
}));
vi.mock("expo-sqlite", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const tableOf = (sql: string) => /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1];
  return {
    openDatabaseAsync: async (name: string) => {
      const db = (sqlite.files.get(name) as InstanceType<typeof DatabaseSync>) ?? new DatabaseSync(":memory:");
      sqlite.files.set(name, db);
      return {
        execAsync: async (sql: string) => void db.exec(sql),
        getFirstAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).get(...params) ?? null,
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        runAsync: async (sql: string, params: unknown[] = []) => {
          const { changes } = db.prepare(sql).run(...params);
          // Like the real listener: one event per changed row.
          for (let i = 0; i < Number(changes); i++) {
            sqlite.listeners.forEach((listener) => listener({ tableName: tableOf(sql) }));
          }
        },
        withTransactionAsync: async (task: () => Promise<void>) => {
          db.exec("BEGIN");
          try {
            await task();
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        },
      };
    },
    addDatabaseChangeListener: (listener: (event: { tableName?: string }) => void) => {
      sqlite.listeners.add(listener);
      return { remove: () => sqlite.listeners.delete(listener) };
    },
  };
});

import {
  deleteCard,
  getCard,
  listCards,
  patchCard,
  replaceDeckCards,
  upsertCards,
  type CardUpsert,
} from "@/db/cards.repo";
import {
  deleteDeck,
  getDeck,
  getDeckScript,
  listDecks,
  pruneDecksNotIn,
  searchDecks,
  setDeckFavourite,
  setDeckScript,
  toggleDeckFavourite,
  upsertDeck,
  upsertDecks,
} from "@/db/decks.repo";
import {
  deleteDraft,
  getDraft,
  listDrafts,
  listVersions,
  pruneDraftsNotIn,
  replaceVersions,
  upsertDraft,
  upsertDrafts,
} from "@/db/generations.repo";
import { clearDatabase, getDatabase, subscribeToTables } from "@/db/index";
import { MIGRATIONS } from "@/db/schema";

const card = (id: string, position: number, over: Partial<CardUpsert> = {}): CardUpsert => ({
  id,
  deckId: "d1",
  position,
  title: `Card ${id}`,
  description: "reveal",
  color: "#fff",
  impact: 0.5,
  delivery: "calm",
  ...over,
});

const raw = async (sql: string, params: unknown[] = []) => (await getDatabase()).runAsync(sql, params as never);

beforeEach(async () => {
  await clearDatabase();
});

describe("connection", () => {
  it("opens once and runs every migration", async () => {
    expect(getDatabase()).toBe(getDatabase());
    const db = await getDatabase();
    await expect(db.getFirstAsync("PRAGMA user_version")).resolves.toEqual({ user_version: MIGRATIONS.length });
  });

  it("a later launch skips migrations already applied", async () => {
    await upsertDeck({ id: "kept", title: "Kept" });
    vi.resetModules();
    const relaunched = await import("@/db/decks.repo");
    await expect(relaunched.getDeck("kept")).resolves.toMatchObject({ title: "Kept" });
  });

  it("coalesces a burst of row events into one callback per table", async () => {
    await upsertDecks([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const onDecks = vi.fn();
    const onDrafts = vi.fn();
    const stop = subscribeToTables(["decks"], onDecks);
    subscribeToTables(["script_drafts"], onDrafts)();

    // One statement, three rows, three events: one re-query.
    await pruneDecksNotIn([]);
    await Promise.resolve();
    expect(onDecks).toHaveBeenCalledOnce();

    // Other tables, and a listener that has unsubscribed, hear nothing.
    await upsertDraft({ id: "g1" });
    await Promise.resolve();
    expect(onDecks).toHaveBeenCalledOnce();
    expect(onDrafts).not.toHaveBeenCalled();

    stop();
    await upsertDeck({ id: "z" });
    await Promise.resolve();
    expect(onDecks).toHaveBeenCalledOnce();
  });

  it("clears every table on sign-out", async () => {
    await upsertDeck({ id: "d1" });
    await upsertCards([card("c1", 0)]);
    await upsertDraft({ id: "g1" });
    await clearDatabase();
    await expect(listDecks()).resolves.toEqual([]);
    await expect(listCards("d1")).resolves.toEqual([]);
    await expect(listDrafts()).resolves.toEqual([]);
  });
});

describe("decks", () => {
  it("merges a list refresh into a detail fetch without blanking it", async () => {
    await upsertDecks([]);
    await upsertDeck({
      id: "d1",
      title: "Pitch",
      description: "Seed round",
      script: "Full script",
      isFavourite: true,
      isPublic: true,
      tags: ["startup", 7 as never],
      category: "sales",
      practiceCount: 2,
      saveCount: 1,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-02",
    });
    // The list endpoint: no script, empty description and tags, nulls elsewhere.
    await upsertDeck({ id: "d1", title: "Pitch v2", description: "", tags: [], isFavourite: true, updatedAt: "" });

    await expect(getDeckScript("d1")).resolves.toBe("Full script");
    await expect(getDeck("d1")).resolves.toEqual({
      id: "d1",
      title: "Pitch v2",
      description: "Seed round",
      color: "#A1AFDE",
      updatedAt: "2026-09-02",
      slideCount: 0,
      durationMins: 0,
      isFavourite: true,
      isPublic: true,
      tags: ["startup"],
      category: "sales",
      practiceCount: 2,
      saveCount: 1,
    });
  });

  /**
   * KNOWN BUG — strict: this test must fail until it's fixed.
   *
   * The VALUES clause defaults a missing `is_favourite` (and `title`, `color`,
   * `duration_mins`, `card_count`) before ON CONFLICT sees it, so
   * `COALESCE(excluded.x, decks.x)` never falls through: an upsert that leaves
   * the flag out resets it to 0. Not reachable today — deckItemToUpsert always
   * sends it — but it contradicts the "keeps whatever is already stored"
   * contract upsertDecks documents.
   */
  it.fails("keeps the favourite flag when an upsert leaves it out", async () => {
    await upsertDeck({ id: "d1", isFavourite: true });
    await upsertDeck({ id: "d1", title: "Renamed" });
    expect((await getDeck("d1"))!.isFavourite).toBe(true);
  });

  it("defaults what was never sent and survives corrupt tags", async () => {
    await upsertDeck({ id: "d1", isFavourite: false, isPublic: false });
    expect(await getDeck("d1")).toMatchObject({ isPublic: false, tags: [], practiceCount: 0, saveCount: 0 });
    await raw("UPDATE decks SET tags = '{broken' WHERE id = 'd1'");
    expect((await getDeck("d1"))!.tags).toEqual([]);
    await raw(`UPDATE decks SET tags = '{"not":"a list"}' WHERE id = 'd1'`);
    expect((await getDeck("d1"))!.tags).toEqual([]);
    await expect(getDeck("missing")).resolves.toBeNull();
    await expect(getDeckScript("missing")).resolves.toBeNull();
  });

  it("sorts and filters the grid", async () => {
    await upsertDecks([
      { id: "a", title: "alpha", durationMins: 5, slideCount: 30, updatedAt: "2026-09-03" },
      { id: "b", title: "Bravo", durationMins: 9, slideCount: 10, updatedAt: "2026-09-01", isFavourite: true },
      { id: "c", title: "charlie", durationMins: 1, slideCount: 20, updatedAt: "2026-09-02" },
    ]);
    const ids = async (...args: Parameters<typeof listDecks>) => (await listDecks(...args)).map((d) => d.id);
    expect(await ids()).toEqual(["a", "c", "b"]);
    expect(await ids("nameAsc")).toEqual(["a", "b", "c"]);
    expect(await ids("nameDesc")).toEqual(["c", "b", "a"]);
    expect(await ids("duration")).toEqual(["b", "a", "c"]);
    expect(await ids("cardCount")).toEqual(["a", "c", "b"]);
    expect(await ids("dateCreated", "favourites")).toEqual(["b"]);
  });

  it("edits the script, the favourite flag, and deletes with its cards", async () => {
    await upsertDeck({ id: "d1", title: "Old" });
    await setDeckScript("d1", "New script");
    expect(await getDeck("d1")).toMatchObject({ title: "Old" });
    await setDeckScript("d1", "Newer script", "New");
    expect(await getDeck("d1")).toMatchObject({ title: "New" });
    await expect(getDeckScript("d1")).resolves.toBe("Newer script");

    await expect(toggleDeckFavourite("d1")).resolves.toBe(true);
    await expect(toggleDeckFavourite("d1")).resolves.toBe(false);
    await expect(toggleDeckFavourite("missing")).resolves.toBe(false);
    await setDeckFavourite("d1", true);
    expect((await getDeck("d1"))!.isFavourite).toBe(true);
    await setDeckFavourite("d1", false);
    expect((await getDeck("d1"))!.isFavourite).toBe(false);

    await upsertCards([card("c1", 0)]);
    await deleteDeck("d1");
    await expect(getCard("c1")).resolves.toBeNull();
  });

  it("prunes decks deleted on another device", async () => {
    await upsertDecks([{ id: "a" }, { id: "b" }, { id: "c" }]);
    await pruneDecksNotIn(["a", "c"]);
    expect((await listDecks("nameAsc")).map((d) => d.id).sort()).toEqual(["a", "c"]);
    await pruneDecksNotIn([]);
    await expect(listDecks()).resolves.toEqual([]);
  });

  it("ranks search hits: title, then description, then script, then a card", async () => {
    await upsertDecks([
      { id: "t", title: "Solar power", updatedAt: "1" },
      { id: "d", title: "Energy", description: "all about SOLAR", updatedAt: "2" },
      { id: "s", title: "Talk", script: "the solar panel story", updatedAt: "3" },
      { id: "k", title: "Other", updatedAt: "4" },
      { id: "x", title: "Unrelated", updatedAt: "5" },
    ]);
    await upsertCards([card("c1", 0, { deckId: "k", title: "Solar in cards" }), card("c2", 1, { deckId: "t", title: "solar" })]);

    const hits = await searchDecks("  solar ");
    expect(hits.map((h) => [h.id, h.matchType])).toEqual([
      ["t", "title"],
      ["d", "description"],
      ["s", "script"],
      ["k", "card"],
    ]);
    await expect(searchDecks("   ")).resolves.toEqual([]);
    // Ties within a rank follow the grid's sort.
    expect((await searchDecks("o", "nameAsc")).map((h) => h.id)).toEqual(["k", "t", "d", "s"]);
  });

  it("searches for what was typed, wildcards included", async () => {
    await upsertDecks([
      { id: "pct", title: "Grew 50% in a year" },
      { id: "plain", title: "Grew 500 in a year" },
      { id: "under", title: "snake_case talk" },
      { id: "snake", title: "snakeXcase talk" },
    ]);
    expect((await searchDecks("50%")).map((h) => h.id)).toEqual(["pct"]);
    expect((await searchDecks("snake_case")).map((h) => h.id)).toEqual(["under"]);
  });
});

describe("cards", () => {
  beforeEach(async () => {
    await upsertDeck({ id: "d1" });
  });

  it("upserts and orders by position", async () => {
    await upsertCards([]);
    await upsertCards([card("c2", 1, { keywords: ["b"] }), card("c1", 0, { version: 4, createdAt: "c", updatedAt: "u" })]);
    await upsertCards([card("c1", 0, { title: "Renamed", version: 5 })]);
    const cards = await listCards("d1");
    expect(cards.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(cards[0]).toMatchObject({ text: "Renamed", reveal: "reveal", version: 5, keywords: [], deckId: "d1" });
    expect(cards[1]).toMatchObject({ keywords: ["b"], version: 1 });
  });

  /**
   * KNOWN BUG — strict: this test must fail until it's fixed.
   *
   * `COALESCE(?, 1)` in VALUES means `excluded.version` is 1, never NULL, so
   * an upsert without a version resets the concurrency token and the next
   * PATCH is rejected as stale. cardToUpsert always sends one today.
   */
  it.fails("keeps the server version when an upsert leaves it out", async () => {
    await upsertCards([card("c1", 0, { version: 4 })]);
    await upsertCards([card("c1", 0, { title: "Renamed" })]);
    expect((await getCard("c1"))!.version).toBe(4);
  });

  it("replaces a deck's set in one go and moves its count", async () => {
    await upsertCards([card("old", 0)]);
    await replaceDeckCards("d1", [card("n1", 0, { keywords: ["x"], version: 2 }), card("n2", 1)]);
    expect((await listCards("d1")).map((c) => c.id)).toEqual(["n1", "n2"]);
    expect((await getDeck("d1"))!.slideCount).toBe(2);
    await expect(getCard("n1")).resolves.toMatchObject({ keywords: ["x"], version: 2 });
  });

  it("patches an edit locally and survives corrupt keywords", async () => {
    await upsertCards([card("c1", 0, { keywords: ["a"] })]);
    await patchCard("c1", { description: "new reveal" });
    expect(await getCard("c1")).toMatchObject({ text: "Card c1", reveal: "new reveal", keywords: ["a"] });
    await patchCard("c1", { title: "T", keywords: ["k", 3 as never] });
    expect(await getCard("c1")).toMatchObject({ text: "T", keywords: ["k", "3"] });

    await raw("UPDATE cards SET keywords = 'nope' WHERE id = 'c1'");
    expect((await getCard("c1"))!.keywords).toEqual([]);
    await raw(`UPDATE cards SET keywords = '"one"' WHERE id = 'c1'`);
    expect((await getCard("c1"))!.keywords).toEqual([]);

    await deleteCard("c1");
    await expect(getCard("c1")).resolves.toBeNull();
  });
});

describe("script drafts", () => {
  it("merges list refreshes without blanking, but clears errors for real", async () => {
    await upsertDrafts([]);
    await upsertDraft({ id: "g1" });
    expect(await getDraft("g1")).toMatchObject({ audience: "general", status: "pending", title: "", script: null });

    await upsertDraft({
      id: "g1",
      description: "Pitch",
      durationMins: 5,
      cardCount: 20,
      audience: "investors",
      title: "Seed",
      script: "Script",
      status: "failed",
      error: "timeout",
      versionCount: 1,
      createdAt: "c",
      updatedAt: "u",
    });
    // A list row: no script, zeros and blanks, and the retry cleared the error.
    await upsertDraft({
      id: "g1",
      description: "",
      durationMins: 0,
      cardCount: 0,
      audience: "investors",
      title: "",
      status: "completed",
      versionCount: 1,
    });
    expect(await getDraft("g1")).toMatchObject({
      description: "Pitch",
      durationMins: 5,
      cardCount: 20,
      audience: "investors",
      title: "Seed",
      script: "Script",
      status: "completed",
      error: null,
      versionCount: 1,
      createdAt: "c",
      updatedAt: "u",
    });
    await expect(getDraft("missing")).resolves.toBeNull();
  });

  /**
   * KNOWN BUG — strict: this test must fail until it's fixed. Reachable today.
   *
   * Restoring a version (use-script-generation) mirrors `{ id, title, script }`
   * only. `status`, `audience` and `version_count` are defaulted in VALUES, so
   * ON CONFLICT writes 'pending', 'general' and 0 over the stored values, and
   * the drafts list shows the draft as pending until the next list refresh.
   */
  it.fails("restoring a version keeps the draft's status, audience and count", async () => {
    await upsertDraft({ id: "g1", audience: "investors", status: "completed", versionCount: 3 });
    await upsertDraft({ id: "g1", title: "v1", script: "restored script" });
    expect(await getDraft("g1")).toMatchObject({ audience: "investors", status: "completed", versionCount: 3 });
  });

  it("lists only what hasn't become a deck, newest first, and prunes", async () => {
    await upsertDrafts([
      { id: "old", updatedAt: "2026-09-01" },
      { id: "new", updatedAt: "2026-09-03" },
      { id: "accepted", updatedAt: "2026-09-04", deckId: "d9" },
    ]);
    expect((await listDrafts()).map((d) => d.id)).toEqual(["new", "old"]);

    await pruneDraftsNotIn(["new"]);
    expect((await listDrafts()).map((d) => d.id)).toEqual(["new"]);
    await pruneDraftsNotIn([]);
    await expect(listDrafts()).resolves.toEqual([]);
    // Pruning never touches a draft that became a deck.
    await expect(getDraft("accepted")).resolves.not.toBeNull();

    await deleteDraft("accepted");
    await expect(getDraft("accepted")).resolves.toBeNull();
  });

  it("mirrors the version history in the order it happened", async () => {
    await upsertDraft({ id: "g1" });
    const version = (id: string, position: number, kind: "generated" | "revised" | "edited", instruction: string | null = null) => ({
      id,
      generationId: "g1",
      position,
      title: `v${position}`,
      script: `script ${position}`,
      kind,
      instruction,
      createdAt: `2026-09-0${position + 1}`,
    });
    await replaceVersions("g1", [version("v2", 1, "revised", "shorter"), version("v1", 0, "generated")]);
    expect((await listVersions("g1")).map((v) => [v.id, v.kind, v.instruction])).toEqual([
      ["v1", "generated", null],
      ["v2", "revised", "shorter"],
    ]);
    await replaceVersions("g1", [version("v1", 0, "generated"), version("v2", 1, "revised"), version("v3", 2, "edited")]);
    await expect(listVersions("g1")).resolves.toHaveLength(3);

    // Versions go with their draft.
    await deleteDraft("g1");
    await expect(listVersions("g1")).resolves.toEqual([]);
  });
});
