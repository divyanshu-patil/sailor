import type { OnboardingStepId } from "@/types/onboarding";

/**
 * The ordered onboarding flow.
 *
 * Adding a step is adding an entry here (and its `OnboardingStepId` to the
 * union, and a renderer in `screens/onboarding/index.tsx`). Reordering is
 * reordering this array — the persisted position is a step *id*, so nobody
 * resumes onto a different question because a screen moved.
 */
export interface OnboardingStepConfig {
  id: OnboardingStepId;
  /**
   * Required steps gate completion; optional ones may be skipped. Not used by
   * the first screen, kept because the flow is explicitly not final.
   */
  required: boolean;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: "profile_identity", required: true },
  { id: "gender", required: true },
  { id: "referral", required: true },
  { id: "speaking_level", required: true },
  { id: "speaking_contexts", required: true },
];

export const FIRST_STEP_ID = ONBOARDING_STEPS[0].id;

/**
 * The planned length of the flow.
 *
 * The bar tracks this rather than the number of *implemented* steps, so a
 * two-step build does not show a full bar on step 2. Bump it as the plan
 * changes; once the array catches up it is just `ONBOARDING_STEPS.length`.
 */
export const ONBOARDING_TOTAL_STEPS = 14;

export function stepIndex(id: OnboardingStepId | null): number {
  if (!id) return -1;
  return ONBOARDING_STEPS.findIndex((step) => step.id === id);
}

/** The step after `id`, or `null` when it was the last one. */
export function nextStepId(id: OnboardingStepId): OnboardingStepId | null {
  const index = stepIndex(id);
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[index + 1].id;
}

/**
 * Fraction of the flow completed, 0–1, derived from the config rather than a
 * hard-coded percentage. Counts the step in progress, matching the reference's
 * small-but-nonzero first bar.
 */
export function progressForStep(id: OnboardingStepId | null): number {
  if (!id) return 1;
  const index = stepIndex(id);
  if (index < 0) return 0;
  const total = Math.max(ONBOARDING_TOTAL_STEPS, ONBOARDING_STEPS.length);
  return (index + 1) / total;
}
