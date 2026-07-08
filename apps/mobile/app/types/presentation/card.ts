export type Delivery =
  | "dramatic"
  | "confident"
  | "explaining"
  | "curious"
  | "storytelling"
  | "pause"
  | "energetic";

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
