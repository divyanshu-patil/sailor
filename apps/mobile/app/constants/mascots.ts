export const MASCOTS = {
  green: require("@/assets/animations/mascots/auth/blob-green.lottie"),
  pink: require("@/assets/animations/mascots/auth/blob-pink.lottie"),
  blue: require("@/assets/animations/mascots/auth/blob-blue.lottie"),
  orange: require("@/assets/animations/mascots/auth/blob-orange.lottie"),
  yellow: require("@/assets/animations/mascots/auth/blob-yellow.lottie"),
  purple: require("@/assets/animations/mascots/auth/blob-purple.lottie"),
} as const;

export type MascotKey = keyof typeof MASCOTS;

// The cream mascot's state-machine file. Unlike the others (single looping
// animation) this one exposes `namaste`/`hello` states toggled by the boolean
// input `isNamaste`; the runtime owns the transition and looping.
export const CREAM_MASCOT_STATES = require("@/assets/animations/mascots/auth/blob-cream-temp.lottie");

// The login screen's hero mascot. It carries a state machine (`blooby`), but
// the login screen plays its `idle` segment as a plain looping animation.
export const LOGIN_MASCOT = require("@/assets/animations/mascots/auth/login-screen-cream.lottie");