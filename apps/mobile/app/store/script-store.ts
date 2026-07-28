import { create } from "zustand";

/**
 * The script currently being worked on, shared between the preview screen and
 * the edit-script modal.
 *
 * `generationId` is a script generation, not a deck. A deck doesn't exist while
 * this store is populated — it's created only when the user accepts the script —
 * which is the whole point of the split: an abandoned script leaves nothing
 * behind but a draft.
 */
interface ScriptStore {
  generationId: string | null;
  title: string;
  script: string;
  setResult: (result: {
    generationId: string;
    title: string;
    script: string;
  }) => void;
  updateScript: (script: string) => void;
  reset: () => void;
}

export const useScriptStore = create<ScriptStore>((set) => ({
  generationId: null,
  title: "",
  script: "",
  setResult: ({ generationId, title, script }) =>
    set({ generationId, title, script }),
  updateScript: (script) => set({ script }),
  reset: () => set({ generationId: null, title: "", script: "" }),
}));
