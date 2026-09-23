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
];

export const FIRST_STEP_ID = ONBOARDING_STEPS[0].id;

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
 * small-but-nonzero first bar; with a one-step flow this is 1.
 */
export function progressForStep(id: OnboardingStepId | null): number {
  if (!id) return 1;
  const index = stepIndex(id);
  if (index < 0) return 0;
  return (index + 1) / ONBOARDING_STEPS.length;
}
