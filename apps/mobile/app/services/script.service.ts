import { apiClient } from "@/lib/api/client";
import { Attachment } from "@/types/presentation";

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
  progress?: number; // 0-100, optional if backend supports it
  error?: string;
}

export interface ScriptResult {
  id: string;
  job_id: string;
  title: string; // AI-generated title
  script: string; // full generated script content
  created_at: string;
}

export const scriptService = {
  // 1. Kick off generation, returns a job_id to poll against
  generate: async (
    payload: GenerateScriptPayload,
  ): Promise<GenerateScriptResponse> => {
    try {
      const response = await apiClient.post<GenerateScriptResponse>(
        "/api/v1/scripts/generate",
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log(
        "script generate error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },

  // 2. Poll this until status === "completed" | "failed" | "cancelled"
  getJobStatus: async (jobId: string): Promise<ScriptJobStatusResponse> => {
    try {
      const response = await apiClient.get<ScriptJobStatusResponse>(
        `/api/v1/scripts/jobs/${jobId}`,
      );
      return response.data;
    } catch (e: any) {
      console.log("script status error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 3. Once completed, fetch the full result
  getResult: async (jobId: string): Promise<ScriptResult> => {
    try {
      const response = await apiClient.get<ScriptResult>(
        `/api/v1/scripts/jobs/${jobId}/result`,
      );
      return response.data;
    } catch (e: any) {
      console.log("script result error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 4. User-initiated stop — cancels server-side
  cancelJob: async (jobId: string): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/scripts/jobs/${jobId}/cancel`);
    } catch (e: any) {
      console.log("script cancel error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  revise: async (jobId: string, instruction: string): Promise<ScriptResult> => {
    try {
      const response = await apiClient.post<ScriptResult>(
        `/api/v1/scripts/jobs/${jobId}/revise`,
        { instruction },
      );
      return response.data;
    } catch (e: any) {
      console.log("script revise error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 6. Manual edit — full replacement text from the edit screen
  edit: async (jobId: string, script: string): Promise<ScriptResult> => {
    try {
      const response = await apiClient.post<ScriptResult>(
        `/api/v1/scripts/jobs/${jobId}/edit`,
        { script },
      );
      return response.data;
    } catch (e: any) {
      console.log("script edit error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
