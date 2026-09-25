import { create } from "zustand";

/**
 * Whether the Sailors Pro screen is owed.
 *
 * Set the moment an account finishes onboarding — the flow run signed in, or
 * one finished before sign-up and handed to the new account — and spent when
 * the screen shows. Keyed to onboarding, not to signing in: an account that
 * onboarded long ago goes straight home on every later sign-in. In memory on
 * purpose: a cold start is never the moment onboarding finished.
 */
interface ProIntroStore {
  pending: boolean;
  markPending: () => void;
  consume: () => void;
}

export const useProIntroStore = create<ProIntroStore>((set) => ({
  pending: false,
  markPending: () => set({ pending: true }),
  consume: () => set({ pending: false }),
}));
