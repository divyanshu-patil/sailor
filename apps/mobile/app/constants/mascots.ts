// export const MASCOTS = {
//   green: require("@/assets/animations/mascots/blob-green.lottie"),
//   pink: require("@/assets/animations/mascots/blob-pink.lottie"),
//   blue: require("@/assets/animations/mascots/blob-blue.lottie"),
//   cream: require("@/assets/animations/mascots/blob-cream.lottie"),
//   orange: require("@/assets/animations/mascots/blob-orange.lottie"),
//   yellow: require("@/assets/animations/mascots/blob-yellow.lottie"),
//   purple: require("@/assets/animations/mascots/blob-purple.lottie"),
// } as const;

export const MASCOTS = {
  green: require("@/assets/animations/mascots/slow/blob-green.lottie"),
  pink: require("@/assets/animations/mascots/slow/blob-pink.lottie"),
  blue: require("@/assets/animations/mascots/slow/blob-blue.lottie"),
  cream: require("@/assets/animations/mascots/slow/blob-cream.lottie"),
  orange: require("@/assets/animations/mascots/slow/blob-orange.lottie"),
  yellow: require("@/assets/animations/mascots/blob-yellow.lottie"),
  purple: require("@/assets/animations/mascots/blob-purple.lottie"),
} as const;

export type MascotKey = keyof typeof MASCOTS;