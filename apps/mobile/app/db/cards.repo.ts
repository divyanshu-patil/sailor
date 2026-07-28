import { getDatabase } from "./index";
import { CardItem, Delivery } from "@/types/presentation/card";

interface CardRow {
  id: string;
  deck_id: string;
  position: number;
  title: string;
  description: string;
  keywords: string;
  color: string;
  impact: number;
  delivery: string;
  version: number;
}

/** Domain shape plus the fields the edit screen and reordering need, which
 *  CardItem itself doesn't carry. */
export interface StoredCard extends CardItem {
  deckId: string;
  position: number;
  keywords: string[];
  /** Server-side optimistic-concurrency token; PATCH sends it back as
   *  `expected_version` and the write is rejected if it has moved on. */
  version: number;
}

export interface CardUpsert {
  id: string;
  deckId: string;
  position: number;
  title: string;
  description: string;
  keywords?: string[];
  color: string;
  impact: number;
  delivery: string;
  version?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // A malformed keywords blob is not worth failing a card render over.
    return [];
  }
}

function toStoredCard(row: CardRow): StoredCard {
  return {
    id: row.id,
    deckId: row.deck_id,
    position: row.position,
    // CardItem calls these `text`/`reveal`; the API and the DB call them
    // title/description. Mapped here so the naming split stops at this line.
    text: row.title,
    reveal: row.description,
    keywords: parseKeywords(row.keywords),
    color: row.color,
    impact: row.impact,
    delivery: row.delivery as Delivery,
    version: row.version,
  };
}

export async function upsertCards(cards: CardUpsert[]): Promise<void> {
  if (cards.length === 0) return;
  const db = await getDatabase();

  const sql = `
    INSERT INTO cards (
      id, deck_id, position, title, description, keywords,
      color, impact, delivery, version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1), ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      deck_id     = excluded.deck_id,
      position    = excluded.position,
      title       = excluded.title,
      description = excluded.description,
      keywords    = excluded.keywords,
      color       = excluded.color,
      impact      = excluded.impact,
      delivery    = excluded.delivery,
      version     = COALESCE(excluded.version, cards.version),
      updated_at  = excluded.updated_at
  `;

  await db.withTransactionAsync(async () => {
    for (const card of cards) {
      await db.runAsync(sql, [
        card.id,
        card.deckId,
        card.position,
        card.title,
        card.description,
        JSON.stringify(card.keywords ?? []),
        card.color,
        card.impact,
        card.delivery,
        card.version ?? null,
        card.createdAt ?? null,
        card.updatedAt ?? null,
      ]);
    }
  });
}

/**
 * Replace a deck's card set wholesale, in one transaction.
 *
 * Card generation rewrites every card and impact colours are ranked across the
 * deck's *whole* set, so merging a new run into an old one would leave cards
 * coloured against a ranking that no longer exists. Delete-then-insert inside a
 * transaction is also what stops a reader seeing an empty deck mid-write.
 */
export async function replaceDeckCards(
  deckId: string,
  cards: CardUpsert[],
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM cards WHERE deck_id = ?", [deckId]);
    for (const card of cards) {
      await db.runAsync(
        `INSERT INTO cards (
           id, deck_id, position, title, description, keywords,
           color, impact, delivery, version, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1), ?, ?)`,
        [
          card.id,
          card.deckId,
          card.position,
          card.title,
          card.description,
          JSON.stringify(card.keywords ?? []),
          card.color,
          card.impact,
          card.delivery,
          card.version ?? null,
          card.createdAt ?? null,
          card.updatedAt ?? null,
        ],
      );
    }
    // card_count is what the deck grid renders, so it has to move with the cards
    // rather than waiting for the next deck-list refresh to correct it.
    await db.runAsync("UPDATE decks SET card_count = ? WHERE id = ?", [
      cards.length,
      deckId,
    ]);
  });
}

export async function listCards(deckId: string): Promise<StoredCard[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CardRow>(
    `SELECT id, deck_id, position, title, description, keywords,
            color, impact, delivery, version
       FROM cards WHERE deck_id = ? ORDER BY position ASC`,
    [deckId],
  );
  return rows.map(toStoredCard);
}

export async function getCard(id: string): Promise<StoredCard | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CardRow>(
    `SELECT id, deck_id, position, title, description, keywords,
            color, impact, delivery, version
       FROM cards WHERE id = ?`,
    [id],
  );
  return row ? toStoredCard(row) : null;
}

/** Local-only patch, used to paint an edit before the server confirms it. */
export async function patchCard(
  id: string,
  patch: { title?: string; description?: string; keywords?: string[] },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE cards
        SET title       = COALESCE(?, title),
            description = COALESCE(?, description),
            keywords    = COALESCE(?, keywords),
            updated_at  = ?
      WHERE id = ?`,
    [
      patch.title ?? null,
      patch.description ?? null,
      patch.keywords ? JSON.stringify(patch.keywords) : null,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM cards WHERE id = ?", [id]);
}
