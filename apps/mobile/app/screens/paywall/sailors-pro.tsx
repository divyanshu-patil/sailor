import { type ComponentProps, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import OrganicBlob from "@/components/ui/organic-blob";
import { fonts } from "@/constants/fonts";
import { useSubscription } from "@/hooks/use-subscription";
import { haptics, weight } from "@/lib/haptics";
import { CurlArrow } from "@/screens/onboarding/components/doodles";
import {
  PROFILE,
  PROFILE_PASTELS,
  profileFonts,
} from "@/screens/profile/theme";
import { useProIntroStore } from "@/store/pro-intro.store";
import { useIsPro } from "@/store/subscription.store";

// LOTTIE-REPLACE — a still from the Blooby animation "Sailors Pro mascot".
const PRO_MASCOT = require("@/assets/images/pro-mascot.png");
/** The still's own proportions, 1080 x 860. */
const MASCOT_RATIO = 860 / 1080;

type Glyph = ComponentProps<typeof Ionicons>["name"];

/**
 * What Pro is, feature by feature. There is no free tier to compare against:
 * everything here needs it, and the one thing that doesn't — reading public
 * decks — is said plainly under the list.
 */
const BENEFITS: { icon: Glyph; tint: string; title: string; body: string }[] = [
  {
    icon: "create-outline",
    tint: PROFILE_PASTELS.mint,
    title: "Scripts written for you",
    body: "Describe your talk. Get a script in your voice, at the length you need.",
  },
  {
    icon: "albums-outline",
    tint: PROFILE_PASTELS.yellow,
    title: "Cue-card decks",
    body: "Every script becomes cards, one beat each, with how to say it.",
  },
  {
    icon: "mic-outline",
    tint: PROFILE_PASTELS.pinkSoft,
    title: "Rehearse out loud",
    body: "Practise with your cards, record yourself, or read from the teleprompter.",
  },
  {
    icon: "sunny-outline",
    tint: PROFILE_PASTELS.blue,
    title: "Daily practice",
    body: "A two-minute drill every day, and a streak that keeps you coming back.",
  },
  {
    icon: "sparkles-outline",
    tint: PROFILE_PASTELS.purple,
    title: "Rewrite in a tap",
    body: "Ask for shorter, warmer or clearer. Every version is kept.",
  },
];

/** Footer pill + "Not now" + their gaps: what the list scrolls clear of. */
const FOOTER_HEIGHT = 58 + 8 + 48;

/**
 * Sailors Pro — what it includes, shown once after signing in to anyone
 * without it. Not the paywall: prices and plans live in the dashboard-built
 * paywall, which "See plans" opens. This screen's job is the why.
 */
export default function SailorsProScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openPaywall } = useSubscription();
  const isPro = useIsPro();
  const [opening, setOpening] = useState(false);

  // Shown once: the owed flag is spent the moment the screen is up.
  useEffect(() => {
    useProIntroStore.getState().consume();
  }, []);

  const enterApp = useCallback(() => {
    router.replace("/(authenticated)/(tabs)/(home)");
  }, []);

  // A subscriber whose entitlement arrives after this screen opened has
  // nothing to decide here.
  useEffect(() => {
    if (isPro) enterApp();
  }, [isPro, enterApp]);

  const seePlans = async () => {
    if (opening) return;
    setOpening(true);
    const outcome = await openPaywall();
    setOpening(false);
    if (outcome === "purchased" || outcome === "restored") {
      haptics.successBig();
      enterApp();
    } else if (outcome === "unavailable") {
      Alert.alert(
        "Plans aren't available right now",
        "Check your connection and try again.",
      );
    }
  };

  // One entrance for the whole page: the mascot grows in, then the words and
  // the list follow it down in a single short cascade.
  const intro = useSharedValue(0);
  useEffect(() => {
    intro.set(
      withDelay(
        80,
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [intro]);

  const mascotWidth = Math.min(width * 0.62, 280);
  const mascotIn = useAnimatedStyle(() => {
    const p = interpolate(intro.value, [0, 0.55], [0, 1], "clamp");
    return {
      opacity: Math.min(1, p * 1.8),
      transform: [{ scale: 0.7 + 0.3 * Easing.out(Easing.back(1.3))(p) }],
    };
  });

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 12,
            paddingBottom: FOOTER_HEIGHT + Math.max(insets.bottom, 16) + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Animated.View style={mascotIn}>
            {/* LOTTIE-REPLACE: the still below stands in for the animation
                until the Lottie is wired in. */}
            <Image
              source={PRO_MASCOT}
              style={{ width: mascotWidth, height: mascotWidth * MASCOT_RATIO }}
              contentFit="contain"
              accessible={false}
            />
            {/*
              <LottieView
                source={require("@/assets/animations/mascots/pro/pro-mascot.lottie")}
                autoPlay
                loop
                style={{ width: mascotWidth, height: mascotWidth * MASCOT_RATIO }}
              />
            */}
          </Animated.View>
          <Rise intro={intro} index={0} style={styles.aside}>
            <Text style={styles.asideText}>{"All of it,\nunlocked."}</Text>
            <View style={styles.asideArrow}>
              <CurlArrow width={38} rotate="12deg" flip />
            </View>
          </Rise>
        </View>

        <Rise intro={intro} index={1}>
          <Text style={styles.wordmark} accessibilityRole="header">
            Sailors Pro
          </Text>
          <View style={styles.marker} />
          <Text style={styles.promise}>
            Everything you need to write, rehearse and deliver a talk.
          </Text>
        </Rise>

        <View style={styles.list}>
          {BENEFITS.map((benefit, i) => (
            <Rise
              key={benefit.title}
              intro={intro}
              index={i + 2}
              style={styles.row}
            >
              <View style={[styles.tile, { backgroundColor: benefit.tint }]}>
                <Ionicons name={benefit.icon} size={23} color={PROFILE.ink} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{benefit.title}</Text>
                <Text style={styles.rowBody}>{benefit.body}</Text>
              </View>
            </Rise>
          ))}
        </View>

        <Rise intro={intro} index={BENEFITS.length + 2}>
          <Text style={styles.free}>
            Exploring and reading public decks stays free.
          </Text>
        </Rise>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {/* The list fades out under the buttons instead of being cut off. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(251,243,234,0)", PROFILE.background]}
          locations={[0, 0.4]}
          style={styles.footerFade}
        />
        <PressableScale
          onPress={seePlans}
          haptic={weight.press}
          style={styles.primary}
          accessibilityRole="button"
          accessibilityLabel="See plans"
          accessibilityState={{ busy: opening }}
        >
          {opening ? (
            <ActivityIndicator color={PROFILE.white} />
          ) : (
            <>
              <Text style={styles.primaryLabel}>See plans</Text>
              <Ionicons
                name="arrow-forward"
                size={22}
                color={PROFILE.white}
                style={styles.primaryArrow}
              />
            </>
          )}
        </PressableScale>
        <PressableScale
          onPress={enterApp}
          style={styles.secondary}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Not now</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** A block of the page arriving in its turn of the one entrance. */
function Rise({
  intro,
  index,
  style,
  children,
}: {
  intro: SharedValue<number>;
  index: number;
  style?: ComponentProps<typeof View>["style"];
  children: React.ReactNode;
}) {
  const start = 0.18 + index * 0.07;
  const rise = useAnimatedStyle(() => {
    const p = interpolate(intro.value, [start, start + 0.35], [0, 1], "clamp");
    return { opacity: p, transform: [{ translateY: (1 - p) * 14 }] };
  });
  return <Animated.View style={[style, rise]}>{children}</Animated.View>;
}

/** The warm ground the auth and onboarding screens stand on. */
function Backdrop() {
  const { width, height } = useWindowDimensions();
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.set(withTiming(1, { duration: 900 }));
  }, [reveal]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <OrganicBlob
        seed="pro-sun"
        width={width * 0.8}
        height={width * 0.8}
        color="#FBEBCB"
        x={width * 0.1}
        y={-width * 0.18}
        opacity={0.9}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="pro-pink"
        width={width * 0.55}
        height={height * 0.34}
        color={PROFILE_PASTELS.pinkSoft}
        x={width * 0.72}
        y={height * 0.42}
        opacity={0.7}
        complexity={5}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="pro-mint"
        width={width * 0.7}
        height={height * 0.36}
        color="#DCEFE0"
        x={-width * 0.36}
        y={height * 0.66}
        opacity={0.75}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PROFILE.background,
  },
  scroll: {
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: "center",
    marginTop: 8,
  },
  // Top right, clear of the heart the mascot holds up on its left.
  aside: {
    position: "absolute",
    right: -6,
    top: 0,
    alignItems: "flex-end",
  },
  asideText: {
    fontFamily: profileFonts.handwritten,
    fontSize: 16,
    lineHeight: 19,
    color: PROFILE.muted,
    transform: [{ rotate: "6deg" }],
  },
  asideArrow: {
    marginTop: 2,
    marginRight: 30,
  },
  wordmark: {
    marginTop: 18,
    fontFamily: fonts.krona,
    fontSize: 32,
    lineHeight: 40,
    textAlign: "center",
    color: PROFILE.ink,
  },
  marker: {
    alignSelf: "center",
    width: 190,
    height: 7,
    marginTop: 2,
    borderRadius: 4,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "-1.2deg" }],
  },
  promise: {
    marginTop: 14,
    paddingHorizontal: 12,
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    color: PROFILE.muted,
  },
  list: {
    marginTop: 30,
    gap: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    paddingTop: 2,
  },
  rowTitle: {
    fontFamily: profileFonts.semibold,
    fontSize: 16.5,
    letterSpacing: -0.2,
    color: PROFILE.ink,
  },
  rowBody: {
    marginTop: 3,
    fontFamily: profileFonts.body,
    fontSize: 14.5,
    lineHeight: 20,
    color: PROFILE.muted,
  },
  free: {
    marginTop: 28,
    fontFamily: profileFonts.medium,
    fontSize: 13.5,
    textAlign: "center",
    color: PROFILE.muted,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  footerFade: {
    ...StyleSheet.absoluteFill,
  },
  primary: {
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PROFILE.ink,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
  primaryArrow: {
    position: "absolute",
    right: 26,
  },
  secondary: {
    marginTop: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    color: PROFILE.ink,
  },
});
