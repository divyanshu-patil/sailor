/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform, useColorScheme } from "react-native";

/**
 * The base surface palette.
 *
 * Both halves must carry the same keys: `ThemeColor` below is derived from
 * `light`, and the themed components index the active scheme's palette with it.
 * A key present in one and missing from the other type-checks but renders
 * `undefined` in that scheme.
 *
 * This is deliberately small — surfaces and text only. Anything with an opinion
 * (deck colours, the user's chosen appearance, the daily-practice surface)
 * lives with the feature that owns it, not here.
 */
const light = {
  rust: "#B75C5C",
  text: "#11181C",
  textSecondary: "#687076",
  background: "#FFFFFF",
  backgroundElement: "#F2F2F7",
  backgroundSelected: "#E4E6EA",
};

const dark = {
  rust: "#B75C5C",
  text: "#ECEDEE",
  textSecondary: "#9BA1A6",
  background: "#151718",
  backgroundElement: "#1F2223",
  backgroundSelected: "#2A2E30",
};

export type ThemePalette = typeof light;

/**
 * The NAME of a colour, not a colour.
 *
 * `ThemedText`/`ThemedView` take this as a prop and look it up
 * (`theme[themeColor ?? 'text']`), so it has to be the key union. It was
 * previously `typeof light & typeof dark` — the palette object itself — which
 * made every call site pass a string where an object was expected and made
 * `theme[...]` an invalid index. That single wrong type produced most of the
 * type errors in this app.
 */
export type ThemeColor = keyof ThemePalette;

/** Scheme-keyed access, for the components that pick a palette themselves
 *  rather than through the hook. */
export const Colors = { light, dark } as const;

export const useColors = (): { colors: ThemePalette } => {
  const isDark = useColorScheme() === "dark";
  return { colors: isDark ? dark : light };
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
