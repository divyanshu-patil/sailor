import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useColors } from "@/constants/theme";
import BlobBackground from "@/screens/presentation/generation/components/background";
import StatusText from "@/screens/presentation/generation/preview/components/generating/components/status-text";
import { generatingMessages } from "@/screens/presentation/generation/preview/components/generating/constants";
import { getGeneratingMessages } from "@/screens/presentation/generation/preview/components/generating/utils/get-generation-messages";
import ScriptText from "@/screens/presentation/generation/preview/components/script-text/script-text";
import Card from "@/screens/presentation/generation/results/components/card";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import type { DemoCard, DemoDetail } from "@/services/onboarding-demo.service";
import type { DeckItem } from "@/types/presentation/deck";
import { AUDIENCE_OPTIONS } from "@/types/presentation";
import { moodLabel } from "./demo-picker";

import type { DemoPhase } from "./demo-footer";

export type { DemoPhase } from "./demo-footer";

/** The preview screen's own lines, minus its opener ("Hii lol") — this is a
 *  first impression, and it's the one line that reads as a placeholder. */
export const DEMO_MESSAGES = generatingMessages.filter((m) => m !== "Hii lol");

const DECK_MESSAGES = [
  "Cutting your script into cue cards",
  "Finding the beat of each moment",
  "Marking where to slow down",
];

/** The settings the script was actually made with, as chips under its title. */
function Settings({ demo }: { demo: DemoDetail }) {
  const audience =
    AUDIENCE_OPTIONS.find((a) => a.value === demo.audience)?.label ?? "General";
  return (
    <Animated.View entering={FadeInDown.duration(360)} style={styles.settings}>
      {[moodLabel(demo.mood), `${demo.durationMinutes} min`, audience].map(
        (text) => (
          <View key={text} style={styles.setting}>
            <Text style={styles.settingLabel}>{text}</Text>
          </View>
        ),
      )}
    </Animated.View>
  );
}

/**
 * The script arriving — the preview screen's own pieces (the blob backdrop,
 * the status line, the progressive script renderer), driven by the stored demo
 * instead of a job poller.
 */
export function DemoScript({
  demo,
  phase,
  bottomInset,
}: {
  demo: DemoDetail | null;
  phase: DemoPhase;
  bottomInset: number;
}) {
  const { colors } = useColors();
  const done = phase === "completed" && !!demo;
  // Memoised for the same reason the preview screen memoises it: StatusText
  // resets on every new array identity.
  const labels = useMemo(
    () =>
      done ? getGeneratingMessages("completed", demo?.title) : DEMO_MESSAGES,
    [done, demo?.title],
  );

  return (
    <View style={styles.fill}>
      <BlobBackground animate={!done} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + 24 },
        ]}
        scrollEnabled={done}
        showsVerticalScrollIndicator={false}
      >
        <StatusText labels={labels} accentColor={colors.rust} />
        {done ? (
          <>
            <Settings demo={demo} />
            <View style={styles.script}>
              <ScriptText script={demo.script} fontSize={18} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const DELIVERY_ICON: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  energetic: "flash",
  calm: "leaf",
  serious: "shield-checkmark",
  storytelling: "book",
  humorous: "happy",
  inspirational: "sparkles",
  explaining: "bulb",
  emphatic: "megaphone",
};

function CardTile({ card, index }: { card: DemoCard; index: number }) {
  return (
    <Animated.View
      entering={FadeInRight.delay(220 + Math.min(index, 5) * 70).duration(420)}
      style={[styles.tile, { backgroundColor: card.color }]}
    >
      <Text style={styles.tileIndex}>
        {String(card.position).padStart(2, "0")}
      </Text>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {card.title}
      </Text>
      <Text style={styles.tileBody} numberOfLines={4}>
        {card.description}
      </Text>
      <View style={styles.tileFoot}>
        <Ionicons
          name={DELIVERY_ICON[card.delivery] ?? "mic"}
          size={13}
          color={PROFILE.ink}
        />
        <Text style={styles.tileDelivery}>{card.delivery}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * The deck being built from the script, then the deck itself — the results
 * screen's own card for it, and a row of the cards inside.
 */
export function DemoDeck({
  demo,
  phase,
  bottomInset,
}: {
  demo: DemoDetail;
  phase: DemoPhase;
  bottomInset: number;
}) {
  const { colors } = useColors();
  const done = phase === "completed";
  const labels = useMemo(
    () =>
      done
        ? getGeneratingMessages("completed", "Your Deck is Ready", null, "deck")
        : DECK_MESSAGES,
    [done],
  );
  const deck: DeckItem = useMemo(
    () => ({
      id: `demo-${demo.id}`,
      title: demo.deck.title,
      description: demo.deck.description,
      color: demo.deck.color,
      updatedAt: new Date().toISOString(),
      slideCount: demo.deck.cards.length,
      durationMins: demo.durationMinutes,
      isFavourite: false,
    }),
    [demo],
  );

  return (
    <View style={styles.fill}>
      <BlobBackground animate={!done} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <StatusText labels={labels} accentColor={colors.rust} />
        {done ? (
          <>
            {/* The real deck card, but not a link: there is no deck to open
                yet — this one exists only in the demo. */}
            <View pointerEvents="none" collapsable={false} style={styles.deck}>
              <Card item={deck} />
            </View>
            <Animated.Text entering={FadeIn.delay(160)} style={styles.caption}>
              {`${demo.deck.cards.length} cue cards, one for each beat of your talk`}
            </Animated.Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tiles}
              style={styles.tilesRow}
            >
              {demo.deck.cards.map((card, index) => (
                <CardTile key={card.position} card={card} index={index} />
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  settings: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  setting: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  settingLabel: {
    fontFamily: profileFonts.medium,
    fontSize: 12.5,
    color: PROFILE.ink,
  },
  script: {
    marginTop: 18,
  },
  deck: {
    // The results screen's card, shrunk: at full size (~480pt tall) it pushes
    // the cue cards under the footer, and they're the part worth seeing. A
    // transform doesn't shrink the layout box, so the margins take back what
    // the scale removed — split top and bottom, as it scales from the centre.
    marginTop: -78,
    marginBottom: -92,
    alignItems: "center",
    transform: [{ scale: 0.62 }],
  },
  caption: {
    marginTop: 22,
    fontFamily: profileFonts.handwritten,
    fontSize: 16,
    color: PROFILE.muted,
    textAlign: "center",
  },
  tilesRow: {
    marginTop: 12,
    marginHorizontal: -20,
  },
  tiles: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  tile: {
    width: 200,
    minHeight: 150,
    padding: 16,
    borderRadius: 22,
    shadowColor: "#6B4A2A",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tileIndex: {
    fontFamily: profileFonts.display,
    fontSize: 13,
    color: "rgba(28,26,24,0.5)",
  },
  tileTitle: {
    marginTop: 6,
    fontFamily: profileFonts.display,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: PROFILE.ink,
  },
  tileBody: {
    marginTop: 6,
    fontFamily: profileFonts.body,
    fontSize: 13,
    lineHeight: 17,
    color: "rgba(28,26,24,0.78)",
  },
  tileFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: "auto",
    paddingTop: 10,
  },
  tileDelivery: {
    fontFamily: profileFonts.semibold,
    fontSize: 12,
    color: PROFILE.ink,
    textTransform: "capitalize",
  },
});
