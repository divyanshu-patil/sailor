import { Attachment } from "@/types/presentation";
import { script } from "./script";

export type ScriptJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerateScriptPayload {
  attachments: Attachment[];
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
}

export interface GenerateScriptResponse {
  job_id: string;
  status: ScriptJobStatus;
}

export interface ScriptJobStatusResponse {
  job_id: string;
  status: ScriptJobStatus;
  progress?: number;
  error?: string;
}

export interface ScriptResult {
  id: string;
  job_id: string;
  title: string;
  script: string;
  created_at: string;
}

// --- DEV-ONLY MOCK STATE -----------------------------------------
// Tracks when each job "started" so getJobStatus can fake a delay
// before flipping to "completed". Delete this whole block once the
// real backend endpoints (/generate, /jobs/:id, /jobs/:id/result,
// /jobs/:id/cancel) are ready — swap the bodies back to apiClient calls.
const DEV_JOB_START_TIMES = new Map<string, number>();
const DEV_CANCELLED_JOBS = new Set<string>();
const DEV_STATUS_CHANGE_MS = 4000;
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
          resolve({ job_id: jobId, status: "pending" });
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

      if (DEV_CANCELLED_JOBS.has(jobId)) {
        return { job_id: jobId, status: "cancelled" };
      }

      const startedAt = DEV_JOB_START_TIMES.get(jobId) ?? Date.now();
      const elapsed = Date.now() - startedAt;

      return await new Promise<ScriptJobStatusResponse>((resolve) => {
        setTimeout(() => {
          if (DEV_CANCELLED_JOBS.has(jobId)) {
            resolve({ job_id: jobId, status: "cancelled" });
            return;
          }

          if (elapsed >= DEV_STATUS_CHANGE_MS) {
            resolve({ job_id: jobId, status: "completed", progress: 100 });
          } else {
            resolve({
              job_id: jobId,
              status: "processing",
              progress: Math.min(
                90,
                Math.round((elapsed / DEV_STATUS_CHANGE_MS) * 100),
              ),
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
};
