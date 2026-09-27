export const MASCOTS = {
  green: require("@/assets/animations/mascots/auth/blob-green.lottie"),
  pink: require("@/assets/animations/mascots/auth/blob-pink.lottie"),
  blue: require("@/assets/animations/mascots/auth/blob-blue.lottie"),
  orange: require("@/assets/animations/mascots/auth/blob-orange.lottie"),
  yellow: require("@/assets/animations/mascots/auth/blob-yellow.lottie"),
  purple: require("@/assets/animations/mascots/auth/blob-purple.lottie"),
} as const;

export type MascotKey = keyof typeof MASCOTS;

// The forgot-password hero mascot. Same cream `namaste`/`hello` machine as
// the old blob-cream-temp file, but without the patterned backdrop baked into it.
export const BLOB_CREAM_MASCOT = require("@/assets/animations/mascots/auth/blob-cream.lottie");

// The Blooby mascots. Most play through `components/ui/skia-mascot` (Skia,
// driven by the file's own state machine); the auth cast and forgot password
// still go through `animated-mascot`. Input names are addresses into the
// .lottie, so they live next to the file.

/** Cheer. Daily practice complete, and the end of a practice deck. */
export const CELEBRATION_MASCOT = {
  source: require("@/assets/animations/mascots/celebration.lottie"),
} as const;

/** Slides in from the right edge of its canvas and peeks. Onboarding name step. */
export const PEEK_MASCOT = {
  source: require("@/assets/animations/mascots/peek-mascot.lottie"),
} as const;

/** The whole auth-screen cast (state machine). `sayHi` false = default pose, true = waving. */
export const ONBOARDING_MASCOTS = {
  source: require("@/assets/animations/mascots/onboarding.lottie"),
  machineId: "mascot",
  input: "sayHi",
  /** Canvas is 1080x1299, not square. */
  aspect: 1299 / 1080,
} as const;

/** Home cards. `shouldPlayFirst` true = the orange pose, false = the pink one. */
export const HOME_BUTTON_MASCOT = {
  source: require("@/assets/animations/mascots/home-screen-buttons.lottie"),
  input: "shouldPlayFirst",
} as const;

/** Onboarding thank-you step. */
export const THANK_YOU_MASCOT = {
  source: require("@/assets/animations/mascots/thank-you.lottie"),
} as const;

/** Every streak-restore scene in one file. String input `state`:
 *  `restore`, `restored` or `error`. */
export const STREAK_RESTORE_MASCOT = {
  source: require("@/assets/animations/mascots/streak-restore.lottie"),
  input: "state",
  /** Canvas is 640x396. */
  aspect: 396 / 640,
} as const;

/** Home hero. String input `state`: `default` (hi), `expiring`, `expired`. */
export const HOME_MASCOT = {
  source: require("@/assets/animations/mascots/home.lottie"),
  input: "state",
} as const;

/** Daily practice: the mascot with its script. */
export const PRACTICE_MASCOT = {
  source: require("@/assets/animations/mascots/practice.lottie"),
} as const;

/** Pull to refresh on the decks grid. Scrubbed by the pull, not played. */
export const PULL_TO_REFRESH_MASCOT = {
  source: require("@/assets/animations/mascots/pull-to-refresh.lottie"),
} as const;

/** Generating screen. Boolean input `isError`: false = tip, true = error. */
export const TIP_MASCOT = {
  source: require("@/assets/animations/mascots/tip.lottie"),
  input: "isError",
} as const;

/** Empty states — holding an empty deck. */
export const NO_DECKS_MASCOT = {
  source: require("@/assets/animations/mascots/no-decks.lottie"),
} as const;

/** Forgot password (state machine). `isSent`: false = idle, true = plane sent. */
export const FORGOT_PASSWORD_MASCOT = {
  source: require("@/assets/animations/mascots/forgot-password.lottie"),
  machineId: "blooby",
  input: "isSent",
} as const;

/** The auth flow's lottie-ios mascots, decoded up front by `MascotPreloader`. */
export const AUTH_PRELOAD = Object.values(MASCOTS);

/**
 * Home's two mascot files — the hero and the cards' — loaded as soon as the
 * app is signed in (see the authenticated layout) and kept for the session by
 * `lib/dotlottie`. Every other mascot loads with its own screen.
 */
export const HOME_PRELOAD = [HOME_MASCOT.source, HOME_BUTTON_MASCOT.source];
