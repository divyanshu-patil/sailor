import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/expo";

import { BottomTabInset } from "@/constants/theme";
import { haptics } from "@/lib/haptics";
import { useAppUserStore } from "@/store/app-user.store";
import { useDailyStore } from "@/store/daily-store";
import { useStreakCountdown } from "@/screens/daily-practice/components/StreakAtRisk";

import { ActionCard, StreakPill } from "./components/action-card";
import { heroHeight, HomeHero } from "./components/hero";
import { StreakIcon, streakStatus } from "./components/streak-icons";
import { cardHeight, homeColors, streakDisplay, wellFor } from "./theme";

/**
 * Greetings, in the register the app actually speaks in.
 *
 * The time-of-day one is computed and prepended rather than listed, so "Good
 * morning" can never greet someone at 9pm. One is picked per mount — the screen
 * is returned to several times a day, which is often enough for a rotating
 * greeting to feel alive and rare enough for it not to feel like a slot machine.
 */
const GREETINGS = [
  "Hey hey,",
  "Yo,",
  "Hola,",
  "Welcome back,",
  "You're here,",
  "Look who's back,",
  "Big day,",
  "Let's gooo,",
  "Okay superstar,",
  "Back at it,",
];

const GAP = 4; // gap between cards

function pickGreeting(now = new Date()): string {
  const hour = now.getHours();
  const timed =
    hour < 12
      ? "Good morning,"
      : hour < 17
        ? "Good afternoon,"
        : "Good evening,";
  const pool = [timed, ...GREETINGS];
  return pool[Math.floor(Math.random() * pool.length)];
}

const capitalise = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Home.
 *
 * A hero that says who you are and how your streak is doing, then the three
 * things this app is for — write one, practise today's, read other people's.
 * Nothing else: every other destination is a tab or lives behind one.
 *
 * The three cards are the screen's CTAs and they all sit in the bottom two
 * thirds, inside thumb reach. The space under the last one is the card's own
 * bottom padding plus the scroll view's, never a margin: the decoration bleeds
 * into it, and a margin would cut the blobs off at the card's edge.
 */
const HomeScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const appUser = useAppUserStore((s) => s.appUser);
  const { user } = useUser();

  // Straight from the cache, not through `useDailyPractice`: home reflects
  // whatever the practice screen last saw and never fires the daily fetch
  // itself. That predates this redesign and is still the right split.
  const streak = useDailyStore((s) => s.streak);
  // Hourly ticks. The hero shows a state, not a countdown — the minute-by-minute
  // clock lives on the practice screen's banner.
  const { target } = useStreakCountdown(3_600_000);

  const status = streakStatus(streak, target?.atRisk ?? false);
  const count = streak?.currentStreak ?? 0;
  const broken = status === "broken";

  // Blob positions are relative to the card, not the window. Full-bleed cards,
  // so the two are the same — keep this in step with `styles.cards`.
  const cardWidth = width;

  const greeting = useMemo(() => pickGreeting(), []);
  const name = capitalise(
    appUser?.nickname?.trim() || user?.firstName?.trim() || "there",
  );

  /** Every card is an entrance into a flow, so they all get the same press. */
  const go = (path: string, options?: { withAnchor: boolean }) => () => {
    haptics.start();
    router.push(path as never, options);
  };

  return (
    <View style={styles.screen}>
      {/* The hero runs behind the status bar, and it is a light surface. */}
      <StatusBar style="dark" />
      {/* Behind the scroll view, not in it: rubber-banding at the top would
          otherwise pull the page's dark background down over the hero. It is
          the hero's full height rather than a fixed strip because a short strip
          gets out-pulled — past its edge a dark band appears between it and the
          hero, which is exactly the artifact a hard pull used to show. */}
      <View
        pointerEvents="none"
        style={[styles.overscroll, { height: insets.top + heroHeight(width) }]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // iOS 26's floating tab bar overlaps content rather than insetting it,
          // so the scroll has to clear it itself. `BottomTabInset` is the bar,
          // `insets.bottom` the home indicator under it.
          { paddingBottom: insets.bottom + BottomTabInset + 20 },
        ]}
      >
        <HomeHero
          width={width}
          topInset={insets.top}
          greeting={greeting}
          name={name}
          streakCount={count}
          status={status}
          // [COMMENT LATER] — target is a placeholder screen.
          onRestorePress={go("/(authenticated)/streak-restore")}
        />

        <View style={styles.cards}>
          <ActionCard
            title="Create New Script"
            subtitle={"Turn your ideas into\na great script."}
            icon="file-plus-2"
            tint={homeColors.cream}
            accessibilityHint="Opens the new script wizard"
            height={cardHeight.script}
            // `withAnchor` so the push zooms out of the thing that was tapped,
            // which is what the toolbar button this replaces already did.
            onPress={go("/(authenticated)/(script)/create-new-script", {
              withAnchor: true,
            })}
            // Each blob is anchored mostly outside the card so only a smooth
            // arc of it crosses the corner — a shapesoup silhouette dropped
            // whole into the middle reads as a smudge, not as decoration.
            // Colours are brand hues at full strength, never a tint of the card.
            blobs={[
              {
                seed: "home-script-a",
                width: 160,
                height: 130,
                color: homeColors.hero,
                x: cardWidth - 64,
                y: 62,
              },
              {
                seed: "home-script-b",
                width: 110,
                height: 90,
                color: homeColors.periwinkle,
                x: -52,
                y: -48,
              },
            ]}
            // Mirrored from the practice card's, which peeks in from the left
            // — two mascots on the same side would read as a repeated element
            // rather than as two characters.
            mascot={{ size: 100, left: cardWidth - 124, bottom: -30 }}
            sparks={[
              { style: { right: 26, bottom: 16 }, color: homeColors.rose },
            ]}
          />

          <ActionCard
            title="Today's Practice"
            subtitle={"Build your habit.\nTrack your progress."}
            icon="flame"
            tint={homeColors.periwinkle}
            accessibilityHint="Opens today's daily practice"
            onPress={go("/(authenticated)/daily-practice")}
            blobs={[
              {
                seed: "home-practice-a",
                width: 170,
                height: 150,
                color: homeColors.rose,
                x: -96,
                y: 74,
              },
              {
                seed: "home-practice-b",
                width: 120,
                height: 96,
                color: homeColors.cream,
                x: cardWidth - 64,
                y: -50,
              },
              {
                seed: "home-practice-c",
                width: 200,
                height: 150,
                color: wellFor(homeColors.cloudBack),
                x: cardWidth - 120,
                y: cardHeight.practice.broken - 50,
              },
            ]}
            // Rides the bottom-left blob, half off the card, the way it
            // half-clears the cloud in the hero — but only while the streak is
            // alive. When it breaks, the hero's mascot is the one carrying that
            // news, and a second one down here just repeats it.
            mascot={broken ? undefined : { size: 104, left: 4, bottom: -34 }}
            // Declared per state, so losing the pill to a broken streak does
            // not collapse the card to one row with the mascot stranded behind
            // the well.
            height={
              broken ? cardHeight.practice.broken : cardHeight.practice.alive
            }
            sparks={
              broken
                ? []
                : [{ style: { left: 148, bottom: 34 }, color: homeColors.hero }]
            }
            badge={
              broken ? null : (
                <StreakPill
                  count={count}
                  icon={
                    <StreakIcon
                      status={status}
                      size={streakDisplay.pillIconSize}
                    />
                  }
                />
              )
            }
          />

          <ActionCard
            title="Browse Public Decks"
            subtitle={"Explore, learn and\npractice from others."}
            icon="users-round"
            tint={homeColors.rose}
            accessibilityHint="Opens decks published by other people"
            onPress={go("/(authenticated)/discover")}
            height={cardHeight.decks}
            blobs={[
              {
                seed: "home-decks-a",
                width: 180,
                height: 140,
                color: homeColors.cream,
                x: -72,
                y: cardHeight.decks - 70,
              },
              {
                seed: "home-decks-b",
                width: 140,
                height: 120,
                color: homeColors.periwinkle,
                x: cardWidth - 82,
                y: 76,
              },
              {
                seed: "home-decks-c",
                width: 110,
                height: 84,
                color: homeColors.hero,
                x: cardWidth * 0.34,
                y: 112,
              },
            ]}
            sparks={[
              { style: { right: 104, bottom: 44 }, color: homeColors.hero },
            ]}
            squiggle={{
              style: { left: cardWidth * 0.3, bottom: 18 },
              color: homeColors.cream,
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: homeColors.screen },
  content: { backgroundColor: homeColors.screen },
  overscroll: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: homeColors.hero,
  },
  cards: { paddingHorizontal: 0, paddingTop: GAP, gap: GAP },
});

export default HomeScreen;
