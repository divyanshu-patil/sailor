/**
 * Nickname rules, mirrored from the backend's `app/utils/nickname.py`.
 *
 * The client validates for instant feedback and to keep the Continue button
 * honest; the server re-validates and owns uniqueness. When these two drift the
 * screen must give way to the server, so keep them in step.
 */

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 30;

export type NicknameValidationCode =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars";

export interface NicknameValidation {
  valid: boolean;
  code?: NicknameValidationCode;
  message?: string;
  /** The display form — trimmed with internal whitespace collapsed. */
  display: string;
  /** The canonical key, matching the backend's `nickname_normalized`. */
  normalized: string;
}

const ALLOWED = /^[\w.\-' ]+$/u;
const HAS_ALNUM = /[^\W_]/u;

export function collapseWhitespace(raw: string): string {
  return raw.trim().split(/\s+/).filter(Boolean).join(" ");
}

export function normalizeNickname(raw: string): string {
  return collapseWhitespace(raw).toLocaleLowerCase();
}

export function validateNickname(raw: string): NicknameValidation {
  const display = collapseWhitespace(raw);
  const normalized = normalizeNickname(display);
  const fail = (
    code: NicknameValidationCode,
    message: string,
  ): NicknameValidation => ({ valid: false, code, message, display, normalized });

  if (!display) return fail("empty", "Please choose a nickname.");
  if (display.length < NICKNAME_MIN_LENGTH) {
    return fail("too_short", `Nicknames need at least ${NICKNAME_MIN_LENGTH} characters.`);
  }
  if (display.length > NICKNAME_MAX_LENGTH) {
    return fail("too_long", `Nicknames can be at most ${NICKNAME_MAX_LENGTH} characters.`);
  }
  if (!ALLOWED.test(display) || !HAS_ALNUM.test(display)) {
    return fail(
      "invalid_chars",
      "Use letters, numbers, spaces, and . ' - _ only.",
    );
  }
  return { valid: true, display, normalized };
}
