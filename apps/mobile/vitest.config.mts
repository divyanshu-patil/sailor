import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the app's logic layer — everything that runs without a
 * device: utilities, types and constants, stores, services, the pure modules
 * behind screens (onboarding flow config, the demo's footer rules, the dial
 * arithmetic, card and text layout), and the libs that wrap native modules —
 * reminders, streak alarms, haptics, purchases, widgets — against fakes of
 * those modules.
 *
 * Coverage is measured over exactly that set and held at 100%. React Native
 * components and hooks are out of scope here: they need a native renderer and
 * are exercised on the simulator (see scripts/check-*.mjs for the checks that
 * run in node against the widget layouts).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "app"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "app/utils/debounce.ts",
        "app/utils/deck-colors.ts",
        "app/utils/format-renewal.ts",
        "app/utils/getCardTitleMargin.ts",
        "app/utils/getRandomNumber.ts",
        "app/utils/nickname.ts",
        "app/utils/parseInlineMarkdown.ts",
        "app/utils/dev-tools.ts",
        "app/types/**/*.ts",
        "app/constants/deck-categories.ts",
        "app/constants/deck-palette.ts",
        "app/constants/dev-mode.ts",
        "app/constants/fonts.ts",
        "app/lib/streak-days.ts",
        "app/lib/notification-copy.ts",
        "app/lib/api/client.ts",
        "app/lib/config/env.ts",
        "app/services/**/*.ts",
        "app/store/**/*.ts",
        "app/screens/onboarding/config/*.ts",
        "app/screens/onboarding/lib/*.ts",
        "app/screens/onboarding/demo/demo-footer.ts",
        "app/screens/onboarding/components/dial-math.ts",
        "app/db/*.ts",
        "app/lib/frame-probe.ts",
        "app/screens/daily-practice/reel.ts",
        "app/screens/profile/theme.ts",
        "app/screens/presentation/teleprompter/*.ts",
        "app/screens/presentation/script-practice/utils/*.ts",
        "app/screens/presentation/script-practice/constants.ts",
        "app/screens/presentation/generation/preview/components/generating/constants.ts",
        "app/screens/presentation/generation/preview/components/script-text/block-metrics.ts",
        "app/screens/presentation/generation/preview/components/script-text/config.ts",
        "app/screens/presentation/generation/preview/components/script-text/text-layout.ts",
        "app/screens/presentation/new-script/components/dial-*.ts",
        "app/screens/presentation/new-script/types/types.ts",
        "app/screens/presentation/decks/components/constants.ts",
        "app/screens/profile/edit-profile/components/constants.ts",
        "app/screens/auth/signup/types/types.ts",
        "app/screens/daily-practice/*.ts",
        "app/screens/home/theme.ts",
        "app/screens/streak-restore/theme.ts",
        "app/constants/header.ts",
        "app/components/ui/animated/AnimatedComponents.ts",
        "app/constants/theme.ts",
        "app/hooks/use-color-scheme.ts",
        "app/lib/api/index.ts",
        "app/lib/daily-reminder.ts",
        "app/lib/generation-guard.ts",
        "app/lib/haptics.ts",
        "app/lib/purchases.ts",
        "app/lib/streak-alarm.ts",
        "app/lib/widget-assets.ts",
        "app/lib/widget-sync.ts",
        "app/utils/audio-cache.ts",
        "app/utils/cache.ts",
      ],
      exclude: ["app/types/env.d.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
