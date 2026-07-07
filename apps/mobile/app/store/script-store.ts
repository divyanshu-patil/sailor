import { create } from "zustand";

interface ScriptStore {
  jobId: string | null;
  title: string;
  script: string;
  setResult: (result: {
    job_id: string;
    title: string;
    script: string;
  }) => void;
  updateScript: (script: string) => void;
  reset: () => void;
}

export const useScriptStore = create<ScriptStore>((set) => ({
  jobId: null,
  title: "",
  script: "",
  setResult: ({ job_id, title, script }) =>
    set({ jobId: job_id, title, script }),
  updateScript: (script) => set({ script }),
  reset: () => set({ jobId: null, title: "", script: "" }),
}));
