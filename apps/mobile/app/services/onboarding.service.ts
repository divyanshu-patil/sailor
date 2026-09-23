import { apiClient } from "@/lib/api/client";
import { userService } from "@/services/user.service";
import type {
  OnboardingState,
  OnboardingStatus,
  OnboardingStepId,
} from "@/types/onboarding";

/** The backend's snake_case shape. Kept private to this module. */
interface ServerOnboardingProgress {
  flow_version: string;
  status: string;
  current_step_id: string | null;
  completed_steps: string[];
  data: Record<string, unknown>;
  completed_at: string | null;
  /** null when the account has never written progress. */
  updated_at: string | null;
}

export interface NicknameAvailability {
  nickname: string;
  normalized: string;
  available: boolean;
  reason: "taken" | "invalid" | "empty" | null;
}

function toState(
  userId: string,
  progress: ServerOnboardingProgress,
): OnboardingState {
  return {
    userId,
    flowVersion: progress.flow_version,
    status: progress.status as OnboardingStatus,
    currentStepId: (progress.current_step_id as OnboardingStepId | null) ?? null,
    data: progress.data ?? {},
    completedSteps: (progress.completed_steps ?? []) as OnboardingStepId[],
    lastUpdatedAt: progress.updated_at ?? new Date().toISOString(),
    completedAt: progress.completed_at,
  };
}

/** True for the backend's 409 — the name was claimed between check and save. */
export function isNicknameTakenError(error: unknown): boolean {
  return (
    (error as { response?: { status?: number } })?.response?.status === 409
  );
}

export const onboardingService = {
  /**
   * The account's persisted position, or `null` when the server holds none.
   * `null` is load-bearing: it is what lets the controller tell "no backend
   * state" from "backend at not_started".
   */
  getProgress: async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<OnboardingState | null> => {
    const response = await apiClient.get<ServerOnboardingProgress>(
      "/api/v1/users/onboarding",
      { signal },
    );
    if (!response.data.updated_at) return null;
    return toState(userId, response.data);
  },

  /** Idempotent full-state upsert. Safe to retry. */
  saveProgress: async (
    state: OnboardingState,
    signal?: AbortSignal,
  ): Promise<OnboardingState> => {
    const response = await apiClient.put<ServerOnboardingProgress>(
      "/api/v1/users/onboarding",
      {
        flow_version: state.flowVersion,
        status: state.status,
        current_step_id: state.currentStepId,
        completed_steps: state.completedSteps,
        data: state.data,
        completed_at: state.completedAt,
      },
      { signal },
    );
    return toState(state.userId, response.data);
  },

  /** Advisory only — the 409 from `claimNickname` is what decides. */
  checkNicknameAvailability: async (
    nickname: string,
    signal?: AbortSignal,
  ): Promise<NicknameAvailability> => {
    const response = await apiClient.get<NicknameAvailability>(
      "/api/v1/users/nickname-available",
      { params: { nickname }, signal },
    );
    return response.data;
  },

  /**
   * Commits the nickname to the account, authoritatively. Throws a 409-shaped
   * axios error when it is already taken; the caller maps that to the "taken"
   * state rather than proceeding.
   */
  claimNickname: async (nickname: string): Promise<void> => {
    await userService.updateProfile({ nickname });
  },

  /** One-way server flag the router and profile screen read. */
  markOnboardingComplete: async (): Promise<void> => {
    await userService.updateProfile({ onboarding_completed: true });
  },
};
