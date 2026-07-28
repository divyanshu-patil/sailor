/**
 * How a card should be spoken aloud.
 *
 * Mirrors SpeakingStyle in app/utils/enums/speaking_style.py exactly — the
 * generator picks from that enum, so anything missing here is a value the API
 * can genuinely send. This list used to carry seven of the thirty-two, which is
 * why cards came back with a delivery the UI had no emoji for. `DeliveryLike`
 * is what services and the DB should use: the wire value is a plain string, and
 * pretending otherwise only moves the failure to render time.
 */
export type Delivery =
  // core
  | "dramatic"
  | "confident"
  | "explaining"
  | "curious"
  | "storytelling"
  | "energetic"
  | "pause"
  // teaching
  | "educational"
  | "analytical"
  | "step_by_step"
  | "technical"
  // presentation
  | "introduction"
  | "summary"
  | "conclusion"
  | "transition"
  | "emphasis"
  // tone
  | "friendly"
  | "casual"
  | "formal"
  | "professional"
  | "inspirational"
  | "motivational"
  | "persuasive"
  | "humorous"
  // pace
  | "calm"
  | "serious"
  | "excited"
  | "urgent"
  | "reflective"
  // interaction
  | "questioning"
  | "interactive"
  | "thought_provoking";

/** A delivery as it arrives from the API — a known value, or one added
 *  server-side since this build shipped. */
export type DeliveryLike = Delivery | (string & {});

export interface CardItem {
  id: string;
  text: string;
  reveal: string;
  impact: number;
  delivery: Delivery;
  color: string;
}

export type CardCreateParams = Omit<CardItem, "id" | "color"> & {
  color?: string; // server can assign via assignColorsByQuantile-equivalent logic if omitted
};

export type CardUpdateParams = Partial<Omit<CardItem, "id">>;

export interface ICardService {
  getCards: (deckId: string) => Promise<CardItem[]>;
  getCard: (deckId: string, id: string) => Promise<CardItem>;
  createCard: (deckId: string, payload: CardCreateParams) => Promise<CardItem>;
  updateCard: (
    deckId: string,
    id: string,
    payload: CardUpdateParams,
  ) => Promise<CardItem>;
  deleteCard: (deckId: string, id: string) => Promise<void>;
  reorderCards: (deckId: string, orderedIds: string[]) => Promise<CardItem[]>;
}
