import { type ComponentProps } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { CurlArrow, Ticks } from "../components/doodles";
import StepTitle from "../components/step-title";
import { StreakWeekPreview } from "../components/widget-previews";

interface Perk {
  icon: ComponentProps<typeof Ionicons>["name"];
  badge: string;
  accent: string;
  title: string;
  body: string;
}

const PERKS: Perk[] = [
  {
    icon: "stats-chart-outline",
    badge: "#FBE1EA",
    accent: "#F28DB2",
    title: "Stay consistent",
    body: "Turn practice into\na daily habit.",
  },
  {
    icon: "star-outline",
    badge: "#DDF1E4",
    accent: "#62C99A",
    title: "See your progress",
    body: "Watch your streak\ngrow over time.",
  },
  {
    icon: "heart-outline",
    badge: "#ECE3FA",
    accent: "#A58AE8",
    title: "Stay motivated",
    body: "Feel proud of\nyour journey.",
  },
];

/**
 * Step 10 — introduces the streak before the reminder time is picked, so the
 * time reads as "when do I keep my streak", not as a settings form.
 */
export default function BuildStreakStep() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min((width - 56) * 0.9, 340);

  return (
    <View style={styles.body}>
      <Animated.View
        entering={FadeIn.delay(380).duration(480)}
        style={styles.noteRow}
      >
        <Text style={styles.note}>{"Consistency\nbuilds confidence!"}</Text>
        <View style={styles.noteArrow}>
          <CurlArrow width={44} rotate="-30deg" />
        </View>
      </Animated.View>

      <View style={styles.hero}>
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={styles.heroTicks}
        >
          <Ticks color="#F28DB2" rotate="-110deg" />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.springify().damping(70)}
          style={{ transform: [{ rotate: "-3deg" }] }}
        >
          <StreakWeekPreview width={cardWidth} />
        </Animated.View>
      </View>

      <View style={styles.title}>
        <StepTitle
          title="Build your streak"
          underline={{ width: 170, x: 58 }}
          subtitle="Show up a little each day and make real progress in your speaking journey."
          delay={180}
        />
      </View>

      <View style={styles.perks}>
        {PERKS.map((perk, i) => (
          <Animated.View
            key={perk.title}
            entering={FadeInDown.delay(300 + i * 70).duration(460)}
            style={styles.perk}
          >
            <View style={[styles.badge, { backgroundColor: perk.badge }]}>
              <View style={styles.perkTicks}>
                <Ticks color={perk.accent} size={0.55} rotate="-8deg" />
              </View>
              <Ionicons name={perk.icon} size={24} color={PROFILE.ink} />
            </View>
            <Text style={styles.perkTitle}>{perk.title}</Text>
            <Text style={styles.perkBody}>{perk.body}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 14,
    marginLeft: 6,
  },
  note: {
    fontFamily: profileFonts.handwritten,
    fontSize: 15.5,
    lineHeight: 19,
    color: PROFILE.muted,
    transform: [{ rotate: "-6deg" }],
  },
  noteArrow: {
    marginLeft: 12,
    marginBottom: -10,
  },
  hero: {
    alignItems: "center",
    marginTop: 18,
  },
  heroTicks: {
    position: "absolute",
    left: -6,
    top: -2,
  },
  title: {
    marginTop: 34,
  },
  perks: {
    flexDirection: "row",
    marginTop: 30,
    marginHorizontal: -12,
  },
  perk: {
    flex: 1,
    alignItems: "center",
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  perkTicks: {
    position: "absolute",
    right: -12,
    top: -10,
  },
  perkTitle: {
    marginTop: 12,
    fontFamily: profileFonts.semibold,
    fontSize: 14.5,
    color: PROFILE.ink,
    textAlign: "center",
  },
  perkBody: {
    marginTop: 4,
    fontFamily: profileFonts.body,
    fontSize: 13,
    lineHeight: 17,
    color: PROFILE.muted,
    textAlign: "center",
  },
});
