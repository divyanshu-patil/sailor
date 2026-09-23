import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { onboardingService } from "@/services/onboarding.service";
import { validateNickname } from "@/utils/nickname";
import { useDebouncedValue } from "./use-debounce";

/**
 * The states the screen can present, and the ones the Continue button reads.
 *
 * `available` is only ever set from a server answer — never optimistically —
 * so the button cannot be enabled on a nickname the server has not confirmed.
 */
export type NicknameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";

export interface NicknameAvailabilityResult {
  status: NicknameAvailabilityStatus;
  message: string | null;
  /** The canonical form the server would store, once confirmed. */
  normalized: string | null;
  /** The display form (trimmed/collapsed) the client would save. */
  display: string;
  /** Re-runs the check — used after a 409 during the final save. */
  recheck: () => void;
}

const CHECK_DEBOUNCE_MS = 400;

interface RemoteAnswer {
  /** Which display value this answer is for. Anything else is stale. */
  forDisplay: string;
  status: "available" | "taken" | "invalid" | "error";
  message: string | null;
  normalized: string | null;
}

/**
 * Debounced, cancellable nickname availability.
 *
 * Two things this must get right:
 *  - no request per keystroke (debounce), and
 *  - a slow answer for an old value must not overwrite a newer one. A sequence
 *    token plus `AbortController` guard it, and the answer is only ever applied
 *    when it names the value still in the field.
 *
 * Local/invalid state is derived during render rather than pushed into state
 * from an effect, so typing does not cascade renders.
 */
export function useNicknameAvailability(
  nickname: string,
): NicknameAvailabilityResult {
  const validation = useMemo(() => validateNickname(nickname), [nickname]);
  const debounced = useDebouncedValue(validation.display, CHECK_DEBOUNCE_MS);

  const [answer, setAnswer] = useState<RemoteAnswer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    if (!validation.valid || !debounced) return;
    // Still debouncing: the settled value has not caught up with the field.
    if (debounced !== validation.display) return;

    const current = ++sequence.current;
    const controller = new AbortController();
    const forDisplay = validation.display;

    onboardingService
      .checkNicknameAvailability(debounced, controller.signal)
      .then((result) => {
        if (current !== sequence.current) return;
        setAnswer({
          forDisplay,
          status: result.available
            ? "available"
            : result.reason === "taken"
              ? "taken"
              : "invalid",
          message: result.available
            ? null
            : result.reason === "taken"
              ? "That nickname is already taken."
              : "That nickname can't be used.",
          normalized: result.normalized,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (current !== sequence.current) return;
        // Never claim availability we could not confirm.
        setAnswer({
          forDisplay,
          status: "error",
          message: "Couldn't check availability. Check your connection and retry.",
          normalized: null,
        });
      });

    return () => controller.abort();
  }, [debounced, validation.valid, validation.display, attempt]);

  const recheck = useCallback(() => {
    // Drop the stale answer first so the button cannot stay enabled on a
    // nickname the server has since rejected.
    setAnswer(null);
    setAttempt((n) => n + 1);
  }, []);

  const trimmed = nickname.trim();
  if (!trimmed) {
    return { status: "idle", message: null, normalized: null, display: validation.display, recheck };
  }
  if (!validation.valid) {
    return {
      status: "invalid",
      message: validation.message ?? "That nickname can't be used.",
      normalized: null,
      display: validation.display,
      recheck,
    };
  }
  if (answer && answer.forDisplay === validation.display) {
    return {
      status: answer.status,
      message: answer.message,
      normalized: answer.normalized,
      display: validation.display,
      recheck,
    };
  }
  // Valid, but no answer for this exact value yet — debouncing or in flight.
  return { status: "checking", message: null, normalized: null, display: validation.display, recheck };
}
