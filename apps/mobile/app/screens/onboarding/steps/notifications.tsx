import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { Ticks } from "../components/doodles";
import PhoneFrame from "../components/phone-frame";
import StepTitle from "../components/step-title";

const PINK = "#F28DB2";

/**
 * Step 8 — the notification ask. Placed after the thank-you so it lands once
 * the user has already invested in the flow, and framed around the streak
 * rather than "notifications" so the system prompt that follows has a reason.
 *
 * The frame swaps its Continue for Allow / Not now on this step — see
 * `frame.tsx`. The phone's notification is a slot, filled later.
 */
export default function NotificationsStep() {
  const { width } = useWindowDimensions();
  // The hero breaks out of the frame's 28pt inset (see `hero` below) so the
  // handwritten asides get the screen's full margins, not the text column's.
  const column = width;
  const phoneWidth = Math.min(column * 0.54, 240);
  const phoneHeight = phoneWidth * 1.42;
  const side = (column - phoneWidth) / 2;

  return (
    <View style={styles.body}>
      <View style={[styles.hero, { height: phoneHeight }]}>
        <Animated.View entering={FadeInDown.springify().damping(70)}>
          <PhoneFrame width={phoneWidth} />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(350).duration(500)}
          style={[styles.abs, { left: side - 44, top: phoneHeight * 0.1 }]}
        >
          <Ticks color={PROFILE.accentYellow} rotate="-8deg" />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(450).duration(500)}
          style={[styles.abs, { right: side - 40, top: phoneHeight * 0.42 }]}
        >
          <Ticks color={PINK} rotate="96deg" />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(550).duration(600)}
          style={[
            styles.abs,
            { left: 10, top: phoneHeight * 0.46, width: side - 4 },
          ]}
        >
          <Text style={[styles.note, { transform: [{ rotate: "-7deg" }] }]}>
            {"A small\nnudge today,\nbig progress\ntomorrow."}
          </Text>
          <Svg
            width={52}
            height={44}
            viewBox="0 0 52 44"
            style={styles.leftArrow}
          >
            <Path
              d="M 6 4 C 2 26, 18 40, 44 32 M 44 32 L 33 26 M 44 32 L 36 42"
              stroke={PROFILE.muted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(650).duration(600)}
          style={[
            styles.abs,
            {
              right: 12,
              top: phoneHeight * 0.66,
              width: side - 14,
              alignItems: "flex-end",
            },
          ]}
        >
          <Text
            style={[
              styles.note,
              { textAlign: "left", transform: [{ rotate: "-7deg" }] },
            ]}
          >
            {"Stay\nconsistent!"}
          </Text>
          <View style={styles.rightDoodles}>
            <Svg width={50} height={44} viewBox="0 0 50 44">
              <Path
                d="M 40 2 C 46 24, 32 38, 8 34 M 8 34 L 18 26 M 8 34 L 17 42"
                stroke={PROFILE.muted}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
            <Svg
              width={30}
              height={28}
              viewBox="0 0 30 28"
              style={styles.heart}
            >
              <Path
                d="M 15 25 C 6 18, 2.5 13, 2.5 8.5 C 2.5 5, 5.2 2.5 8.5 2.5 C 11.2 2.5 13.6 4.3 15 6.8 C 16.4 4.3 18.8 2.5 21.5 2.5 C 24.8 2.5 27.5 5 27.5 8.5 C 27.5 13 24 18 15 25 Z"
                stroke={PINK}
                strokeWidth={3.4}
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
        </Animated.View>
      </View>

      <View style={styles.title}>
        <StepTitle
          title="Stay in the loop."
          underline={{ width: 214, x: 14 }}
          subtitle="Gentle nudges to keep your streak alive."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  hero: {
    marginTop: 34,
    marginHorizontal: -28,
    alignItems: "center",
  },
  abs: {
    position: "absolute",
  },
  note: {
    fontFamily: profileFonts.handwritten,
    fontSize: 15.5,
    lineHeight: 19.5,
    color: PROFILE.muted,
  },
  leftArrow: {
    marginTop: 6,
    marginLeft: 22,
  },
  rightDoodles: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    marginRight: 6,
  },
  heart: {
    marginLeft: 4,
    marginBottom: -12,
    transform: [{ rotate: "10deg" }],
  },
  underline: {
    alignSelf: "center",
    marginTop: 2,
    width: 214,
    height: 7,
    borderRadius: 4,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "-1.2deg" }, { translateX: 14 }],
  },
  title: {
    marginTop: 30,
  },
});
