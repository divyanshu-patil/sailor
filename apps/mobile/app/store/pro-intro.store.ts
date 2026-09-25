import { create } from "zustand";

/**
 * Whether the Sailors Pro screen is owed.
 *
 * Set the moment someone signs in during this launch, spent when the screen
 * shows. In memory on purpose: a cold start of an app that was already signed
 * in is not "after the login", and must go straight home.
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
