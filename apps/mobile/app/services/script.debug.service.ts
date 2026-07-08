import { script } from "./dummyData/script";
import {
  DeckResult,
  GenerateScriptPayload,
  GenerateScriptResponse,
  ScriptJobStatusResponse,
  ScriptResult,
} from "./script.service";

// --- DEV-ONLY MOCK STATE -----------------------------------------
// Tracks when each job "started" so getJobStatus can fake a delay
// before flipping to "completed". Delete this whole block once the
// real backend endpoints (/generate, /jobs/:id, /jobs/:id/result,
// /jobs/:id/cancel, /jobs/:id/confirm, /jobs/:id/deck-result) are
// ready — swap the bodies back to apiClient calls.
const DEV_JOB_START_TIMES = new Map<string, number>();
const DEV_CANCELLED_JOBS = new Set<string>();
const DEV_STATUS_CHANGE_MS = 4000;
const DEV_SCRIPT_OVERRIDES = new Map<
  string,
  { title: string; script: string }
>();

const DECK_STATUS_CHANGE_MS = 6000;
const deckJobStore = new Map<string, { startedAt: number }>();

// -------------------------------------------------------------------

export const scriptService = {
  generate: async (
    payload: GenerateScriptPayload,
  ): Promise<GenerateScriptResponse> => {
    try {
      // const response = await apiClient.post<GenerateScriptResponse>(
      //   "/api/v1/scripts/generate",
      //   payload,
      // );
      // return response.data;

      const jobId = `dev-${Date.now()}`;

      const response = await new Promise<GenerateScriptResponse>((resolve) => {
        setTimeout(() => {
          DEV_JOB_START_TIMES.set(jobId, Date.now());
          resolve({ job_id: jobId, status: "pending", type: "script" });
        }, 500); // simulate initial POST latency
      });

      return response;
    } catch (e: any) {
      console.log(
        "script generate error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },

  getJobStatus: async (jobId: string): Promise<ScriptJobStatusResponse> => {
    try {
      // const response = await apiClient.get<ScriptJobStatusResponse>(
      //   `/api/v1/scripts/jobs/${jobId}`,
      // );
      // return response.data;

      const isDeckJob = deckJobStore.has(jobId);
      const type: "script" | "deck" = isDeckJob ? "deck" : "script";

      if (DEV_CANCELLED_JOBS.has(jobId)) {
        return { job_id: jobId, status: "cancelled", type };
      }

      if (isDeckJob) {
        const { startedAt } = deckJobStore.get(jobId)!;
        const elapsed = Date.now() - startedAt;

        return await new Promise<ScriptJobStatusResponse>((resolve) => {
          setTimeout(() => {
            if (DEV_CANCELLED_JOBS.has(jobId)) {
              resolve({ job_id: jobId, status: "cancelled", type });
              return;
            }

            if (elapsed >= DECK_STATUS_CHANGE_MS) {
              resolve({
                job_id: jobId,
                status: "completed",
                progress: 100,
                type,
              });
            } else {
              resolve({
                job_id: jobId,
                status: "processing",
                progress: Math.min(
                  90,
                  Math.round((elapsed / DECK_STATUS_CHANGE_MS) * 100),
                ),
                type,
              });
            }
          }, 300); // simulate GET latency
        });
      }

      const startedAt = DEV_JOB_START_TIMES.get(jobId) ?? Date.now();
      const elapsed = Date.now() - startedAt;

      return await new Promise<ScriptJobStatusResponse>((resolve) => {
        setTimeout(() => {
          if (DEV_CANCELLED_JOBS.has(jobId)) {
            resolve({ job_id: jobId, status: "cancelled", type });
            return;
          }

          if (elapsed >= DEV_STATUS_CHANGE_MS) {
            resolve({
              job_id: jobId,
              status: "completed",
              progress: 100,
              type,
            });
          } else {
            resolve({
              job_id: jobId,
              status: "processing",
              progress: Math.min(
                90,
                Math.round((elapsed / DEV_STATUS_CHANGE_MS) * 100),
              ),
              type,
            });
          }
        }, 300); // simulate GET latency
      });
    } catch (e: any) {
      console.log("script status error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getResult: async (jobId: string): Promise<ScriptResult> => {
    try {
      // const response = await apiClient.get<ScriptResult>(
      //   `/api/v1/scripts/jobs/${jobId}/result`,
      // );
      // return response.data;

      return await new Promise<ScriptResult>((resolve) => {
        setTimeout(() => {
          resolve({
            id: `result-${jobId}`,
            job_id: jobId,
            title: "The Future of Renewable Energy",
            script: script,
            created_at: new Date().toISOString(),
          });
        }, 400); // simulate GET latency
      });
    } catch (e: any) {
      console.log("script result error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  cancelJob: async (jobId: string): Promise<void> => {
    try {
      // await apiClient.post(`/api/v1/scripts/jobs/${jobId}/cancel`);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          DEV_CANCELLED_JOBS.add(jobId);
          resolve();
        }, 200); // simulate POST latency
      });
    } catch (e: any) {
      console.log("script cancel error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  revise: async (jobId: string, instruction: string): Promise<ScriptResult> => {
    try {
      return await new Promise<ScriptResult>((resolve) => {
        setTimeout(() => {
          const prev = DEV_SCRIPT_OVERRIDES.get(jobId);
          const base = prev?.script ?? script;
          const title = prev?.title ?? "The Future of Renewable Energy";
          const revised = `${base}\n\n[Revised: "${instruction}"]`;
          DEV_SCRIPT_OVERRIDES.set(jobId, { title, script: revised });
          resolve({
            id: `result-${jobId}`,
            job_id: jobId,
            title,
            script: revised,
            created_at: new Date().toISOString(),
          });
        }, 900); // simulate AI latency, longer than a plain edit
      });
    } catch (e: any) {
      console.log("script revise error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  edit: async (jobId: string, newScript: string): Promise<ScriptResult> => {
    try {
      return await new Promise<ScriptResult>((resolve) => {
        setTimeout(() => {
          const title =
            DEV_SCRIPT_OVERRIDES.get(jobId)?.title ??
            "The Future of Renewable Energy";
          DEV_SCRIPT_OVERRIDES.set(jobId, { title, script: newScript });
          resolve({
            id: `result-${jobId}`,
            job_id: jobId,
            title,
            script: newScript,
            created_at: new Date().toISOString(),
          });
        }, 250);
      });
    } catch (e: any) {
      console.log("script edit error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  confirm: async (jobId: string): Promise<GenerateScriptResponse> => {
    try {
      // const response = await apiClient.post<GenerateScriptResponse>(
      //   `/api/v1/scripts/jobs/${jobId}/confirm`,
      // );
      // return response.data;

      // Confirm mints a new "deck job" derived from the script job.
      const deckJobId = `deck-${jobId}-${Date.now()}`;

      return await new Promise<GenerateScriptResponse>((resolve) => {
        setTimeout(() => {
          deckJobStore.set(deckJobId, { startedAt: Date.now() });
          resolve({ job_id: deckJobId, status: "pending", type: "deck" });
        }, 500); // simulate initial POST latency
      });
    } catch (e: any) {
      console.log("script confirm error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getDeckResult: async (jobId: string): Promise<DeckResult> => {
    try {
      // const response = await apiClient.get<DeckResult>(
      //   `/api/v1/scripts/jobs/${jobId}/deck-result`,
      // );
      // return response.data;

      if (!deckJobStore.has(jobId)) {
        throw new Error(`Unknown deck job: ${jobId}`);
      }

      return await new Promise<DeckResult>((resolve) => {
        setTimeout(() => {
          resolve({
            id: `deck-result-${jobId}`,
            job_id: jobId,
            title: "The Future of Renewable Energy",
            created_at: new Date().toISOString(),
          });
        }, 400); // simulate GET latency
      });
    } catch (e: any) {
      console.log("deck result error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
