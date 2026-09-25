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
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView, type SFSymbol } from "expo-symbols";
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
import Svg, { Path } from "react-native-svg";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import OrganicBlob from "@/components/ui/organic-blob";
import { fonts } from "@/constants/fonts";
import { useSubscription } from "@/hooks/use-subscription";
import { haptics, weight } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { useProIntroStore } from "@/store/pro-intro.store";
import { useIsPro } from "@/store/subscription.store";
import ProHero from "./pro-hero";

const PURPLE = "#8B6CF0";
/** The list's ground: a touch lighter than the page, so the hero sits in its
 *  own warmer zone above it. */
const PANEL = "#FDF8F2";
const WAVE_HEIGHT = 44;
const GOLD = "#F4BE3E";

/** An SF Symbol, optionally with a smaller one set inside it — the file with
 *  an infinity, the calendar with a flame. */
interface Glyph {
  name: SFSymbol;
  inner?: SFSymbol;
}

/**
 * What Pro is. Four headline features, then "and much more" — there is no free
 * tier to compare against, so the list says what you get rather than what you
 * lack.
 */
const BENEFITS: {
  glyph: Glyph;
  color: string;
  tint: string;
  title: string;
  body: string;
}[] = [
  {
    glyph: { name: "doc", inner: "infinity" },
    color: PURPLE,
    tint: "#EEE8FD",
    title: "Unlimited Scripts",
    body: "Create and save as many scripts as you want.",
  },
  {
    glyph: { name: "flame.fill" },
    color: "#F0843A",
    tint: "#FDEBD8",
    title: "Daily Practice",
    body: "A new short practice every day to build your habit.",
  },
  {
    glyph: { name: "wand.and.stars" },
    color: "#EC5C9C",
    tint: "#FCE4EF",
    title: "Rewrite on Tap",
    body: "Make your script shorter, clearer or warmer.",
  },
  {
    glyph: { name: "mic.fill" },
    color: "#27B384",
    tint: "#DDF3EA",
    title: "Rehearse Out Loud",
    body: "Use the teleprompter or record yourself, and get better every take.",
  },
];

const PRIMARY_HEIGHT = 58;
const SECONDARY_HEIGHT = 50;
const FOOTER_GAP = 8;
/** Both pills and the gap between them: what the list scrolls clear of. */
const FOOTER_HEIGHT = PRIMARY_HEIGHT + FOOTER_GAP + SECONDARY_HEIGHT;

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

  // One entrance for the whole page: the hero settles in while the words and
  // the list follow in a single short cascade.
  const intro = useSharedValue(0);
  useEffect(() => {
    intro.set(
      withDelay(
        60,
        withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [intro]);

  const heroWidth = Math.min(width * 0.64, 290);
  const heroIn = useAnimatedStyle(() => {
    const p = interpolate(intro.value, [0, 0.6], [0, 1], "clamp");
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [
        { translateX: (1 - p) * 24 },
        { scale: 0.92 + 0.08 * p },
      ],
    };
  });

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Animated.View
            pointerEvents="none"
            style={[styles.hero, { width: heroWidth }, heroIn]}
          >
            <ProHero width={heroWidth} />
          </Animated.View>

          <PressableScale
            onPress={enterApp}
            haptic={weight.tap}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={PROFILE.ink} />
          </PressableScale>

          <Rise intro={intro} index={0} style={styles.heading}>
            <SymbolView
              name="crown.fill"
              size={38}
              tintColor={GOLD}
              style={styles.crown}
            />
            <Text
              style={styles.sailors}
              accessibilityRole="header"
              accessibilityLabel="Sailors Pro"
            >
              Sailors
            </Text>
            <Text style={styles.pro} accessibilityElementsHidden>
              Pro
            </Text>
          </Rise>

          <Rise intro={intro} index={1} style={styles.taglineWrap}>
            <Text style={styles.tagline}>
              {"Practice more.\nProgress faster."}
            </Text>
            <Svg width={150} height={12} viewBox="0 0 150 12">
              <Path
                d="M3 8.5 C 40 4.5, 95 3.5, 147 5"
                stroke={GOLD}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Rise>
        </View>

        <View
          style={[
            styles.panel,
            { paddingBottom: FOOTER_HEIGHT + Math.max(insets.bottom, 16) + 28 },
          ]}
        >
          {/* The list's lighter ground, rising in a soft wave over the foot
              of the hero. */}
          <Svg
            pointerEvents="none"
            width={width}
            height={WAVE_HEIGHT}
            viewBox={`0 0 ${width} ${WAVE_HEIGHT}`}
            preserveAspectRatio="none"
            style={styles.wave}
          >
            <Path
              d={`M0 ${WAVE_HEIGHT * 0.8} C ${width * 0.35} ${WAVE_HEIGHT * 0.95}, ${width * 0.55} ${WAVE_HEIGHT * 0.02}, ${width * 0.78} ${WAVE_HEIGHT * 0.12} C ${width * 0.9} ${WAVE_HEIGHT * 0.18}, ${width * 0.96} ${WAVE_HEIGHT * 0.5}, ${width} ${WAVE_HEIGHT * 0.62} L ${width} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z`}
              fill={PANEL}
            />
          </Svg>
          <View style={styles.list}>
          {BENEFITS.map((benefit, i) => (
            <Rise key={benefit.title} intro={intro} index={i + 2}>
              <PressableScale
                onPress={seePlans}
                haptic={weight.tap}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`${benefit.title}. ${benefit.body}`}
                accessibilityHint="Opens the plans"
              >
                <View style={[styles.tile, { backgroundColor: benefit.tint }]}>
                  <BenefitGlyph glyph={benefit.glyph} color={benefit.color} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{benefit.title}</Text>
                  <Text style={styles.rowBody}>{benefit.body}</Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={21}
                  color={PROFILE.ink}
                  style={styles.rowArrow}
                />
              </PressableScale>
            </Rise>
          ))}

          <Rise intro={intro} index={BENEFITS.length + 2} style={styles.more}>
            <SymbolView name="sparkles" size={18} tintColor={PURPLE} />
            <Text style={styles.moreText}>and much more</Text>
          </Rise>
          </View>
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {/* The list fades out under the buttons instead of being cut off. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(253,248,242,0)", "rgba(253,248,242,0.94)"]}
          locations={[0, 0.2]}
          style={styles.footerFade}
        />
        <FootBlobs />
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

/** A feature's icon: one SF Symbol, or one with a smaller one set inside. */
function BenefitGlyph({ glyph, color }: { glyph: Glyph; color: string }) {
  if (!glyph.inner) {
    return (
      <SymbolView
        name={glyph.name}
        size={32}
        weight="semibold"
        tintColor={color}
        style={styles.glyph}
      />
    );
  }
  return (
    <View style={styles.glyph}>
      <SymbolView
        name={glyph.name}
        size={36}
        weight="semibold"
        tintColor={color}
        style={styles.glyph}
      />
      <View style={styles.glyphInner}>
        <SymbolView
          name={glyph.inner}
          size={16}
          weight="heavy"
          tintColor={color}
          style={styles.glyphSmall}
        />
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
  const start = 0.12 + index * 0.07;
  const rise = useAnimatedStyle(() => {
    const p = interpolate(intro.value, [start, start + 0.35], [0, 1], "clamp");
    return { opacity: p, transform: [{ translateY: (1 - p) * 14 }] };
  });
  return <Animated.View style={[style, rise]}>{children}</Animated.View>;
}

/** The warm glow behind the hero, top right. */
function Backdrop() {
  const { width } = useWindowDimensions();
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.set(withTiming(1, { duration: 900 }));
  }, [reveal]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <OrganicBlob
        seed="pro-sun"
        width={width * 0.75}
        height={width * 0.75}
        color="#FCEBC4"
        x={width * 0.45}
        y={-width * 0.28}
        opacity={0.85}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
    </View>
  );
}

/** Lavender and pink at the foot, behind the buttons — in the footer's layer
 *  so the list's panel, which runs to the bottom, doesn't cover them. */
function FootBlobs() {
  const { width } = useWindowDimensions();
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.set(withTiming(1, { duration: 900 }));
  }, [reveal]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <OrganicBlob
        seed="pro-lilac"
        width={width * 0.62}
        height={width * 0.62}
        color="#E9E2FB"
        x={-width * 0.32}
        y={width * 0.02}
        opacity={0.8}
        complexity={5}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="pro-rose"
        width={width * 0.5}
        height={width * 0.5}
        color="#FBE0E6"
        x={width * 0.74}
        y={-width * 0.02}
        opacity={0.8}
        complexity={5}
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
  top: {},
  hero: {
    position: "absolute",
    right: 4,
    top: 10,
  },
  panel: {
    flexGrow: 1,
    backgroundColor: PANEL,
  },
  wave: {
    position: "absolute",
    top: -WAVE_HEIGHT + 1,
    left: 0,
  },
  close: {
    marginLeft: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PROFILE.white,
    shadowColor: "#8A6A45",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: {
    marginTop: 8,
    paddingLeft: 28,
  },
  crown: {
    width: 40,
    height: 38,
    marginBottom: 2,
    marginLeft: 2,
  },
  sailors: {
    fontFamily: profileFonts.display,
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -2.4,
    color: PROFILE.ink,
  },
  // Kalam's ascenders need the full line or they clip; the negative margins
  // take back the air it leaves above and below.
  pro: {
    marginTop: -20,
    marginBottom: -14,
    fontFamily: fonts.kalam.bold,
    fontSize: 70,
    lineHeight: 104,
    color: PURPLE,
  },
  taglineWrap: {
    marginTop: 6,
    marginBottom: 22,
    paddingLeft: 30,
  },
  tagline: {
    fontFamily: fonts.kalam.regular,
    fontSize: 21,
    lineHeight: 27,
    color: PROFILE.muted,
  },
  list: {
    paddingTop: 2,
    paddingHorizontal: 24,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 4,
  },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    width: 38,
    height: 38,
  },
  glyphSmall: {
    width: 18,
    height: 18,
  },
  glyphInner: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: profileFonts.display,
    fontSize: 17.5,
    letterSpacing: -0.4,
    color: PROFILE.ink,
  },
  rowBody: {
    marginTop: 3,
    fontFamily: profileFonts.body,
    fontSize: 14.5,
    lineHeight: 20,
    color: PROFILE.muted,
  },
  rowArrow: {
    marginLeft: 4,
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -2,
    paddingLeft: 84,
  },
  moreText: {
    fontFamily: fonts.kalam.regular,
    fontSize: 21,
    color: PROFILE.muted,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: FOOTER_GAP,
  },
  footerFade: {
    ...StyleSheet.absoluteFill,
  },
  primary: {
    height: PRIMARY_HEIGHT,
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
    height: SECONDARY_HEIGHT,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E6DCCF",
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    color: PROFILE.ink,
  },
});
