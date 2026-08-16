export { useApiState, useApiMutation } from "./use-api-state";
export type { UseApiStateOptions, UseApiStateReturn, UseApiStateMutateOptions } from "./use-api-state";

export { usePreferenceStore } from "@/store/preference-store";

export { useDecks, filterAndSortDecks } from "./use-decks";
export type {
  UseDecksOptions,
  UseDecksReturn,
  DeckFilterType,
  DeckSortOption,
} from "./use-decks";

export { useDeck } from "./use-deck";
export type { UseDeckOptions, UseDeckReturn } from "./use-deck";

export { usePublicDecks } from "./use-public-decks";
export type {
  UsePublicDecksOptions,
  UsePublicDecksReturn,
} from "./use-public-decks";

export { useCards } from "./use-cards";
export type {
  UseCardsOptions,
  UseCardsReturn,
  SaveCardOutcome,
} from "./use-cards";

// Script generation lives with the screens that own it:
// screens/presentation/hooks/use-script-generation.ts
// Drafts are app-wide, though — a script that never became a deck is browsable
// from anywhere, so the list hook lives here.
export { useScriptDrafts } from "./use-script-drafts";
export type {
  UseScriptDraftsOptions,
  UseScriptDraftsReturn,
} from "./use-script-drafts";

export { useUser } from "./use-user";
export type { UseUserOptions, UseUserReturn } from "./use-user";

export { useAppearanceOptions } from "./use-appearance";

export { usePreferences } from "./use-preferences";
export type { UsePreferencesOptions, UsePreferencesReturn } from "./use-preferences";

export { useAccount } from "./use-account";
export type { UseAccountOptions, UseAccountReturn } from "./use-account";