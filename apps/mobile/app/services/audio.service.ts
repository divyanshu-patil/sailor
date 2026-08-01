import { apiClient } from "@/lib/api/client";
import { AxiosRequestHeaders } from "axios";

export interface AudioUploadResponse {
  deck_id: number;
  has_audio: boolean;
}

export interface AudioPlaybackUrlResponse {
  audio_url: string;
  expires_in_seconds: number;
}

export interface RemoveAudioResponse {
  deck_id: number;
  has_audio: boolean;
}

export type AudioService = typeof audioService;

export const audioService = {
  uploadRecording: async (
    deckId: string,
    uri: string,
  ): Promise<AudioUploadResponse> => {
    try {
      const formData = new FormData();
      // RN's FormData wants { uri, name, type } here, not a real File/Blob —
      // typed `as any` because RN's FormData typings don't model this shape,
      // even though it's the standard pattern for native multipart uploads.
      formData.append("file", {
        uri,
        name: "recording.m4a",
        type: "audio/m4a",
      } as any);

      const response = await apiClient.post<AudioUploadResponse>(
        `/api/v1/decks/${deckId}/audio`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } as AxiosRequestHeaders },
      );
      return response.data;
    } catch (e: any) {
      console.log("upload recording error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getPlaybackUrl: async (deckId: string): Promise<AudioPlaybackUrlResponse> => {
    try {
      const response = await apiClient.get<AudioPlaybackUrlResponse>(
        `/api/v1/decks/${deckId}/audio-url`,
      );
      return response.data;
    } catch (e: any) {
      console.log("get playback url error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  deleteRecording: async (deckId: string): Promise<RemoveAudioResponse> => {
    try {
      const response = await apiClient.delete<RemoveAudioResponse>(
        `/api/v1/decks/${deckId}/audio`,
      );
      return response.data;
    } catch (e: any) {
      console.log("delete recording error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};