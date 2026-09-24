import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import Svg, { Path } from "react-native-svg";

import { fonts } from "@/constants/fonts";
import { PROFILE, profileFonts } from "@/screens/profile/theme";

/**
 * Pictures of the home-screen widgets, for onboarding.
 *
 * Not the widgets themselves — those are SwiftUI and live in another process —
 * but drawn from the same baked plates and characters in assets/widgets, so
 * what the user is shown here is what lands on their home screen.
 */
export const WIDGET_ART = {
  plateMedium: require("../../../../assets/widgets/widget-bg-cool-medium.png"),
  plateSmall: require("../../../../assets/widgets/widget-bg-cool-small.png"),
  plateStreak: require("../../../../assets/widgets/widget-bg-streak-cool.png"),
  plateWeek: require("../../../../assets/widgets/widget-bg-streak-week.png"),
  mascotCream: require("../../../../assets/widgets/widget-mascot-cream.png"),
  mascotPurple: require("../../../../assets/widgets/widget-mascot-purple.png"),
  mascotGreen: require("../../../../assets/widgets/widget-mascot-green.png"),
  mascotPeek: require("../../../../assets/widgets/widget-mascot-peek.png"),
  mascotPeekPaws: require("../../../../assets/widgets/widget-mascot-peek-paws.png"),
  flame: require("../../../../assets/widgets/widget-flame.png"),
  flameSoft: require("../../../../assets/widgets/widget-flame-soft.png"),
};

/** The mascot PNGs are 512 x 360 domes, cropped flat along the bottom. */
const DOME = 360 / 512;

/** Today, as the widget prints it — "Fri, Sep 18". */
function todayLabel(): string {
  try {
    return new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 1.5 C12.9 7.6 16.4 11.1 22.5 12 C16.4 12.9 12.9 16.4 12 22.5 C11.1 16.4 7.6 12.9 1.5 12 C7.6 11.1 11.1 7.6 12 1.5 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Shared tile chrome: a plate edge to edge, rounded like the real widget. */
function Tile({
  width,
  height,
  plate,
  children,
  flip,
}: {
  width: number;
  height: number;
  plate: number;
  children: React.ReactNode;
  /** Mirrors the plate top-to-bottom. The practice plates carry a confetti
   *  curl in their top corner, which collides with the title at preview
   *  size; flipped, it tucks in behind the character instead. */
  flip?: boolean;
}) {
  return (
    <View
      style={[
        styles.shadow,
        { width, height, borderRadius: width > height * 1.5 ? 26 : 24 },
      ]}
    >
      <View
        style={[styles.tile, { borderRadius: width > height * 1.5 ? 26 : 24 }]}
      >
        <Image
          source={plate}
          style={[
            StyleSheet.absoluteFill,
            flip && { transform: [{ scaleY: -1 }] },
          ]}
          contentFit="fill"
        />
        {children}
      </View>
    </View>
  );
}

function Mascot({
  source,
  width,
  right,
  bottom,
}: {
  source: number;
  width: number;
  right: number;
  bottom: number;
}) {
  return (
    <Image
      source={source}
      style={{
        position: "absolute",
        width,
        height: width * DOME,
        right,
        bottom,
      }}
      contentFit="contain"
    />
  );
}

export const PracticePreview = memo(function PracticePreview({
  width,
}: {
  width: number;
}) {
  const s = width / 338;
  const height = 158 * s;
  return (
    <Tile width={width} height={height} plate={WIDGET_ART.plateMedium} flip>
      <Mascot
        source={WIDGET_ART.mascotCream}
        width={150 * s}
        right={6 * s}
        bottom={-26 * s}
      />
      <View style={{ padding: 16 * s, gap: 7 * s }}>
        <View style={styles.row}>
          <Sparkle size={22 * s} color="#6E9CF4" />
          <Text style={[styles.title, { fontSize: 19 * s, marginLeft: 8 * s }]}>
            Today&apos;s Practice
          </Text>
          <View style={styles.flex} />
          <Text style={[styles.hand, { fontSize: 12 * s }]}>
            {todayLabel()}
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            { paddingHorizontal: 9 * s, paddingVertical: 3 * s },
          ]}
        >
          <Text style={[styles.pillLabel, { fontSize: 11.5 * s }]}>
            Speaking Confidence
          </Text>
        </View>
        <Text
          style={[
            styles.quote,
            { fontSize: 16 * s, lineHeight: 20 * s, width: 196 * s },
          ]}
        >
          {"“A little progress every day leads to big results.”"}
        </Text>
      </View>
    </Tile>
  );
});

export const ReminderPreview = memo(function ReminderPreview({
  width,
}: {
  width: number;
}) {
  const s = width / 170;
  return (
    <Tile width={width} height={width} plate={WIDGET_ART.plateSmall} flip>
      <Mascot
        source={WIDGET_ART.mascotPurple}
        width={112 * s}
        right={-4 * s}
        bottom={-22 * s}
      />
      <View style={{ padding: 13 * s }}>
        <View style={styles.row}>
          <View
            style={[
              styles.badge,
              { width: 30 * s, height: 30 * s, backgroundColor: "#FBD6E3" },
            ]}
          >
            <Ionicons name="notifications" size={16 * s} color={PROFILE.ink} />
          </View>
          <Text
            style={[
              styles.title,
              { fontSize: 13.5 * s, lineHeight: 16 * s, marginLeft: 7 * s },
            ]}
          >
            {"Practice\nReminder"}
          </Text>
          <View style={styles.flex} />
          <Text
            style={[styles.meta, { fontSize: 10 * s, alignSelf: "flex-start" }]}
          >
            9:00 AM
          </Text>
        </View>
        <Text
          style={[
            styles.body,
            { fontSize: 13 * s, lineHeight: 17 * s, marginTop: 10 * s },
          ]}
        >
          {"Time for your\ndaily practice!"}
        </Text>
        <View
          style={[
            styles.startNow,
            {
              marginTop: 10 * s,
              paddingHorizontal: 10 * s,
              paddingVertical: 5 * s,
            },
          ]}
        >
          <Text style={[styles.startLabel, { fontSize: 11 * s }]}>
            Start Now
          </Text>
          <Ionicons name="arrow-forward" size={11 * s} color={PROFILE.ink} />
        </View>
      </View>
    </Tile>
  );
});

export const StreakPreview = memo(function StreakPreview({
  width,
}: {
  width: number;
}) {
  const s = width / 170;
  return (
    <Tile width={width} height={width} plate={WIDGET_ART.plateStreak}>
      <Mascot
        source={WIDGET_ART.mascotGreen}
        width={104 * s}
        right={0}
        bottom={-22 * s}
      />
      <View style={{ padding: 13 * s }}>
        <View style={styles.row}>
          <View
            style={[
              styles.badge,
              { width: 30 * s, height: 30 * s, backgroundColor: "#FDE3D2" },
            ]}
          >
            <Image
              source={WIDGET_ART.flame}
              style={{ width: 20 * s, height: 20 * s }}
              contentFit="contain"
            />
          </View>
          <Text
            style={[styles.title, { fontSize: 13.5 * s, marginLeft: 7 * s }]}
          >
            Your Streak
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 4 * s, marginLeft: 6 * s }]}>
          <Text
            style={[styles.count, { fontSize: 42 * s, lineHeight: 50 * s }]}
          >
            7
          </Text>
          <Text
            style={[
              styles.body,
              { fontSize: 11.5 * s, lineHeight: 14 * s, marginLeft: 8 * s },
            ]}
          >
            {"days\nin a row!"}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 4 * s }]}>
          <Text
            style={[
              styles.hand,
              { fontSize: 14 * s, transform: [{ rotate: "-5deg" }] },
            ]}
          >
            Keep going!
          </Text>
          <Ionicons
            name="heart"
            size={12 * s}
            color="#F4C24D"
            style={{ marginLeft: 4 * s, marginTop: -8 * s }}
          />
        </View>
      </View>
    </Tile>
  );
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The medium streak-week widget, redrawn for the "Build your streak" step:
 * a count card, a Mon–Sun row, and the character gripping the row's top edge
 * — body under the card, paws over it, same two-image trick as the widget.
 */
export const StreakWeekPreview = memo(function StreakWeekPreview({
  width,
  done = 6,
}: {
  width: number;
  /** How many days from Monday are ticked. */
  done?: number;
}) {
  const s = width / 338;
  const height = width * 0.7;
  const inset = 10 * s;
  const weekH = 76 * s;
  const cardTop = height - inset - weekH;
  const mascotW = 150 * s;
  const mascotH = mascotW * 0.75;
  const mascotTop = cardTop - mascotH * 0.79 + 2 * s;
  const mascot = (source: number) => (
    <Image
      source={source}
      style={{
        position: "absolute",
        width: mascotW,
        height: mascotH,
        right: 18 * s,
        top: mascotTop,
      }}
      contentFit="contain"
    />
  );

  return (
    <View style={[styles.shadow, { width, height, borderRadius: 30 * s }]}>
      <View
        style={[
          styles.tile,
          { borderRadius: 30 * s, backgroundColor: "#F6F0E8" },
        ]}
      >
        <Image
          source={WIDGET_ART.plateWeek}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {mascot(WIDGET_ART.mascotPeek)}

        <View
          style={[
            styles.card,
            {
              left: inset,
              top: inset,
              width: width * 0.5,
              height: cardTop - inset - 8 * s,
              borderRadius: 20 * s,
              padding: 14 * s,
            },
          ]}
        >
          <View style={styles.row}>
            <Image
              source={WIDGET_ART.flameSoft}
              style={{ width: 24 * s, height: 24 * s }}
              contentFit="contain"
            />
            <Text
              style={[styles.title, { fontSize: 16 * s, marginLeft: 6 * s }]}
            >
              Your Streak
            </Text>
          </View>
          <View style={styles.flex} />
          <View style={styles.row}>
            <Text
              style={[styles.count, { fontSize: 60 * s, lineHeight: 64 * s }]}
            >
              {done + 1}
            </Text>
            <Text
              style={[
                styles.body,
                { fontSize: 16 * s, lineHeight: 20 * s, marginLeft: 10 * s },
              ]}
            >
              {"days\nin a row!"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.keepGoing,
            {
              right: inset + 4 * s,
              top: inset + 4 * s,
              paddingHorizontal: 13 * s,
              paddingVertical: 6 * s,
            },
          ]}
        >
          <Text style={[styles.keepGoingLabel, { fontSize: 13.5 * s }]}>
            Keep going!
          </Text>
        </View>

        <View
          style={[
            styles.card,
            styles.week,
            {
              left: inset,
              right: inset,
              top: cardTop,
              height: weekH,
              borderRadius: 20 * s,
              paddingTop: 8 * s,
              paddingHorizontal: 6 * s,
            },
          ]}
        >
          {DAYS.map((day, i) => {
            const ticked = i < done;
            return (
              <View key={day} style={styles.day}>
                <View
                  style={[
                    styles.dot,
                    {
                      width: 32 * s,
                      height: 32 * s,
                      backgroundColor: ticked ? "#F7DC8F" : "#EEF0F6",
                    },
                  ]}
                >
                  {ticked ? (
                    <Ionicons
                      name="checkmark-sharp"
                      size={17 * s}
                      color={PROFILE.ink}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.dayLabel,
                    { fontSize: 12 * s, marginTop: 5 * s },
                  ]}
                >
                  {day}
                </Text>
              </View>
            );
          })}
        </View>

        {mascot(WIDGET_ART.mascotPeekPaws)}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shadow: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#8A6A45",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tile: {
    flex: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: profileFonts.semibold,
    color: PROFILE.ink,
    letterSpacing: -0.2,
  },
  hand: {
    fontFamily: fonts.kalam.regular,
    color: PROFILE.muted,
  },
  meta: {
    fontFamily: profileFonts.medium,
    color: PROFILE.muted,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FADBB9",
  },
  pillLabel: {
    fontFamily: profileFonts.semibold,
    color: "#C08440",
  },
  quote: {
    fontFamily: fonts.amarna.medium,
    color: PROFILE.ink,
  },
  badge: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontFamily: profileFonts.medium,
    color: PROFILE.ink,
  },
  startNow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  startLabel: {
    fontFamily: profileFonts.semibold,
    color: PROFILE.ink,
  },
  card: {
    position: "absolute",
    backgroundColor: "#FFFDFA",
    shadowColor: "#6B4A2A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  week: {
    flexDirection: "row",
  },
  day: {
    flex: 1,
    alignItems: "center",
  },
  dot: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontFamily: profileFonts.medium,
    color: PROFILE.muted,
  },
  keepGoing: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#F8E4A9",
  },
  keepGoingLabel: {
    fontFamily: profileFonts.semibold,
    color: "#85661F",
  },
  count: {
    fontFamily: profileFonts.display,
    color: PROFILE.ink,
    letterSpacing: -1,
  },
});
