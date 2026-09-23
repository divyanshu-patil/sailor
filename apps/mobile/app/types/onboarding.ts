/**
 * The onboarding workflow's persisted shape.
 *
 * Not to be confused with `onboarding-completion.store.ts`, which answers only
 * "has this account finished?". This one is the *position*: which step, with
 * what answers, and whether it is done. It is what lets the app resume after a
 * kill instead of starting over.
 */

/**
 * The version of the flow these step ids belong to.
 *
 * Bumped when the flow's shape changes in a way an older position cannot be
 * read as-is (a removed or renamed step). It is stored beside the position so a
 * future migration can tell which flow a record came from. Date-style on
 * purpose: a bare `1` says nothing about what changed.
 */
export const ONBOARDING_FLOW_VERSION = "2026-09";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

/**
 * Every step the flow knows. Extend this union as steps are added; the config
 * in `screens/onboarding/config/steps.ts` is the ordered list.
 */
export type OnboardingStepId = "profile_identity" | "gender" | "referral";

/**
 * The scope a pre-auth onboarding record is stored under.
 *
 * Onboarding runs before sign-up, so there is no user id to key it by yet. This
 * sentinel is the MMKV key suffix; on sign-in the record is handed off to the
 * account (`onboarding:<userId>`) and this one is cleared.
 */
export const PENDING_SCOPE = "pending";

export interface OnboardingData {
  /** The display form the user chose. Mirrored on `users.nickname` once saved. */
  nickname?: string;
  /** `normalizeNickname(nickname)`, kept so the record is self-describing. */
  nicknameNormalized?: string;
  /** "male" | "female" | "unspecified" — the display gender the user chose. */
  gender?: string;
  /** Where the user heard about Sailors, e.g. "instagram" | "search". */
  referral?: string;
  /** Future steps' answers, each keyed by its own name. */
  [key: string]: unknown;
}

export interface OnboardingState {
  /** The account this position belongs to. Local storage is keyed by this too. */
  userId: string;
  flowVersion: string;
  status: OnboardingStatus;
  /** `null` only when completed. This — never a numeric index — is persisted. */
  currentStepId: OnboardingStepId | null;
  data: OnboardingData;
  completedSteps: OnboardingStepId[];
  /** ISO timestamp of the last local write, compared against the server's. */
  lastUpdatedAt: string;
  completedAt: string | null;
}

export function createInitialOnboardingState(
  userId: string,
  currentStepId: OnboardingStepId,
): OnboardingState {
  return {
    userId,
    flowVersion: ONBOARDING_FLOW_VERSION,
    status: "in_progress",
    currentStepId,
    data: {},
    completedSteps: [],
    lastUpdatedAt: new Date().toISOString(),
    completedAt: null,
  };
}
