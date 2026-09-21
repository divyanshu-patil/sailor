import { fonts } from "@/constants/fonts";

/**
 * The profile screen's palette.
 *
 * Deliberately fixed rather than derived from the appearance preference: the
 * profile is the app's "home" for the account and uses the same warm cream
 * language as onboarding/auth, so it reads as the same product on every device.
 */
export const PROFILE = {
  background: "#FBF3EA",
  ink: "#1C1A18",
  muted: "#8E887E",
  lightButton: "#F5EDE4",
  white: "#FFFFFF",
} as const;

/** Soft pastels for the decorative shapes and the settings icon badges. */
export const PROFILE_PASTELS = {
  pink: "#F6C9D8",
  logout: "#ef3850",
  pinkSoft: "#FBDDE3",
  planCard: "#FBEBCB",
  planBorder: "#F1DFB0",
  yellow: "#FBE9C4",
  blue: "#DCE8FB",
  mint: "#D8EFE1",
  purple: "#EADDF8",
} as const;

export const profileFonts = {
  display: fonts.alanSans.bold,
  semibold: fonts.alanSans.semiBold,
  medium: fonts.alanSans.medium,
  body: fonts.alanSans.regular,
  serif: fonts.newsreader.regular,
  handwritten: fonts.kalam.regular,
} as const;
