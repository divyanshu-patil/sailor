/**
 * The active scheme's palette.
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemePalette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Returns the whole palette, because every consumer indexes it by colour name
 * (`theme[themeColor ?? 'text']`). It previously returned a hardcoded
 * `{ primary: '#000' }`, so every one of those lookups was `undefined` at
 * runtime and a type error at build time.
 */
export function useTheme(): ThemePalette {
  const scheme = useColorScheme();
  return Colors[scheme === "dark" ? "dark" : "light"];
}
