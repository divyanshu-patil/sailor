// [COMMENT LATER]
import React from "react";
import { Button, Section, Text } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";

import { dailyPracticeService } from "@/services/daily-practice.service";
import { useDailyStore } from "@/store/daily-store";
import { localDate, type StreakState } from "@/types/daily";

// [COMMENT LATER]
// No override flag and no dev-only store: this writes a real StreakState into
// the real cache, so `streakDeadline` and `streakStatus` derive the state the
// same way they do in production. A fake status short-circuits the one bit of
// logic worth testing.
const DAY = 24 * 60 * 60 * 1000;

const STATES: { label: string; streak: StreakState }[] = [
  {
    label: "Alive — 12 days, done today",
    streak: {
      currentStreak: 12,
      longestStreak: 12,
      lastCompletedDate: localDate(),
      completedToday: true,
    },
  },
  {
    label: "At risk — last day to save it",
    streak: {
      currentStreak: 12,
      longestStreak: 12,
      lastCompletedDate: localDate(new Date(Date.now() - DAY)),
      completedToday: false,
    },
  },
  {
    label: "Broken — restore available",
    streak: {
      currentStreak: 0,
      longestStreak: 12,
      lastCompletedDate: null,
      completedToday: false,
      restorableStreak: 12,
      canRestore: true,
      restoreUsedThisMonth: false,
    },
  },
  {
    // The restore screen reads `restoreUsedThisMonth` on mount and opens
    // straight into its capped state, so this is how that screen is reached
    // without burning a real restore on the server.
    label: "Broken — restore already used",
    streak: {
      currentStreak: 0,
      longestStreak: 12,
      lastCompletedDate: null,
      completedToday: false,
      restorableStreak: 12,
      canRestore: false,
      restoreUsedThisMonth: true,
    },
  },
];

// [COMMENT LATER]
export function DevStreakSection({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const setStreak = useDailyStore((s) => s.setStreak);
  const setPendingComplete = useDailyStore((s) => s.setPendingComplete);

  const apply = (label: string, streak: StreakState) => {
    // A queued offline completion counts as "practised today" inside
    // streakDeadline, so it has to go or "at risk" never reads as at risk.
    setPendingComplete(null);
    // Tagged so the restore screen does not immediately replace it with the
    // server's real answer — see `simulated` on StreakState.
    setStreak({ ...streak, simulated: true });
    onMessage(`Streak set to: ${label}. Go to Home to see it.`);
  };

  return (
    <Section
      title="Streak states (dev only)"
      footer={
        <Text modifiers={[foregroundStyle("#8E8E93")]}>
          Writes a fake streak into the local cache to preview the home
          screen&apos;s flame / hourglass / broken-heart states. It sticks until
          you restore it below — daily practice skips its fetch while a streak
          is already cached.
        </Text>
      }
    >
      {STATES.map(({ label, streak }) => (
        <Button
          key={label}
          label={label}
          onPress={() => apply(label, streak)}
        />
      ))}
      {/* [COMMENT LATER] — without this the simulator is a one-way door: the
          mount guard in useDailyPractice skips its fetch while a streak is
          cached, so a faked one sticks until the cache is cleared. */}
      <Button
        label="Restore real streak from server"
        onPress={async () => {
          try {
            setPendingComplete(null);
            const real = await dailyPracticeService.getStreak();
            // Untagged: this IS the real one, so screens may refresh it again.
            setStreak(real);
            // Reports the numbers, not just "done": the server's answer is
            // often the same as what is already on screen, and a bare success
            // message makes a working restore look like a no-op.
            onMessage(
              `Restored from server: ${real.currentStreak} day streak ` +
                `(best ${real.longestStreak}, ` +
                `${real.completedToday ? "done" : "not done"} today).`,
            );
          } catch (e: any) {
            onMessage(
              `Restore failed: ${e?.response?.status ?? ""} ${
                e?.message ?? "could not reach the server"
              }`.trim(),
            );
          }
        }}
      />
    </Section>
  );
}
