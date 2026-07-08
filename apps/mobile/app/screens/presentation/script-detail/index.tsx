import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";
import { Host, Text as SwiftUIText } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import Pill from "./components/pill";
import CtaButton from "./components/cta-button";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { deckService, DeckItem } from "@/services/deck.debug.service";

type ScriptDetailParams = {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: string;
  durationMins: string;
  isFavourite: string;
};

const ANIMATION_DELAY = 300; // ms before anything starts
const ZOOM_START_SCALE = 0.7; // how small the card starts (0.3 = very dramatic)
const ROTATE_OVERSHOOT = 2; // back easing overshoot (1 = none, 2 = wild)
const SPRING_DAMPING = 12; // lower = more bouncy
const SPRING_STIFFNESS = 100; // lower = slower spring
const ROTATE_DURATION = 600; // ms for rotation + shadow translate

export default function ScriptDetailScreen() {
  const params = useLocalSearchParams<ScriptDetailParams>();
  const [cardHeight, setCardHeight] = useState(100);
  const [cardCountNum1, setCardCountNum1] = useState(0);
  const [cardCountNum2, setCardCountNum2] = useState(0);

  const cardScale = useSharedValue(ZOOM_START_SCALE);
  const cardRotate = useSharedValue(0); // starts tilted far left
  const shadowOffsetX = useSharedValue(0);
  const shadowOffsetY = useSharedValue(0);

  const paramScript: DeckItem = useMemo(
    () => ({
      id: params.id,
      title: params.title,
      description: params.description,
      color: params.color,
      updatedAt: new Date(params.updatedAt),
      slideCount: Number(params.slideCount),
      durationMins: Number(params.durationMins),
      isFavourite:
        params.isFavourite != null ? JSON.parse(params.isFavourite) : false,
    }),
    [params],
  );

  const [script, setScript] = useState<DeckItem>(paramScript);
  const [isFavourite, setIsFavourite] = useState(paramScript.isFavourite);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await deckService.getDeck(paramScript.id);
        if (!cancelled) {
          setScript(fresh);
          setIsFavourite(fresh.isFavourite);
        }
      } catch (e) {
        // keep showing param-derived data if the refresh fails
        console.log("getDeck refresh error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramScript.id]);

  const handleToggleFavourite = async () => {
    const next = !isFavourite;
    setIsFavourite(next); // optimistic
    try {
      const updated = await deckService.toggleFavourite(script.id);
      setIsFavourite(updated.isFavourite);
    } catch (e) {
      setIsFavourite(!next); // revert on failure
      console.log("toggleFavourite error", e);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deckService.deleteDeck(script.id);
      router.back();
    } catch (e) {
      setIsDeleting(false);
      console.log("deleteDeck error", e);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      setCardCountNum1(Number(script.slideCount.toString().charAt(0)));
      setCardCountNum2(Number(script.slideCount.toString().charAt(1)));
    }, 500);

    cardScale.value = withDelay(
      ANIMATION_DELAY,
      withSpring(1, {
        damping: SPRING_DAMPING,
        stiffness: SPRING_STIFFNESS,
        mass: 0.8,
      }),
    );

    cardRotate.value = withDelay(
      ANIMATION_DELAY,
      withTiming(5, {
        duration: ROTATE_DURATION,
        easing: Easing.out(Easing.back(ROTATE_OVERSHOOT)),
      }),
    );

    // shadow starts at same position as hero card (0,0)
    // then peels away left+down as hero rotates right
    shadowOffsetX.value = withDelay(
      ANIMATION_DELAY,
      withTiming(-6, {
        duration: ROTATE_DURATION,
        easing: Easing.out(Easing.back(ROTATE_OVERSHOOT)),
      }),
    );

    shadowOffsetY.value = withDelay(
      ANIMATION_DELAY,
      withTiming(8, {
        duration: ROTATE_DURATION,
        easing: Easing.out(Easing.back(ROTATE_OVERSHOOT)),
      }),
    );

    return () => {
      setCardCountNum1(0);
      setCardCountNum2(0);
    };
  }, [cardRotate, cardScale, script.slideCount, shadowOffsetX, shadowOffsetY]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { rotate: `${cardRotate.value}deg` },
    ],
  }));

  // shadow inherits the same scale so it's perfectly stacked at start
  const animatedShadowStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value }, // <-- matches hero card scale exactly
      { translateX: shadowOffsetX.value },
      { translateY: shadowOffsetY.value },
    ],
  }));

  const scriptText = `Your CPU speaks at the speed of light. Your hard disk speaks at the speed of a bicycle. And somehow — they have to talk to each other. 
Every single time you open a file, plug in a keyboard, or save your work. The system that makes that conversation possible — without crashing, without data loss, without freezing your processor — is the *Advanced I/O System*. And understanding it is understanding the backbone of every computer ever built.`;

  const textDarkColor = colord(script.color)
    .darken(0.35)
    .desaturate(0.5)
    .toHex();
  const textTitleColor = colord(script.color)
    .darken(0.25)
    .desaturate(0.6)
    .toHex();
  const cardColor = script.color;
  const scriptCardColor = script.color;
  const screenColor = colord(script.color).lighten(0.18).toHex();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Stack.Screen options={{ headerShown: false }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={isFavourite ? "heart.fill" : "heart"}
          tintColor={"#EB6B83"}
          onPress={handleToggleFavourite}
        />
        <Stack.Toolbar.Button icon={"square.and.arrow.up"} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon={"trash"}
          variant="prominent"
          tintColor={"#f55c53"}
          disabled={isDeleting}
          onPress={handleDelete}
        />
      </Stack.Toolbar>
      <ScrollView
        style={[styles.screen, { backgroundColor: screenColor }]}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          {/* Background shadow card — translates in sync with hero card rotation */}
          <Animated.View
            style={[
              {
                height: cardHeight,
                width: "100%",
                backgroundColor: textDarkColor,
                position: "absolute",
                borderRadius: 77,
              },
              animatedShadowStyle,
            ]}
          />

          {/* Hero card — zooms in then rotates to resting angle */}
          <Link.AppleZoomTarget>
            <Animated.View
              onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
              style={[
                styles.heroCard,
                { backgroundColor: cardColor },
                animatedCardStyle,
              ]}
            >
              <View style={styles.heroContent}>
                <Text style={[styles.heroTitle, { color: textDarkColor }]}>
                  {script.title}
                </Text>
                <CtaButton
                  label="GO"
                  accentColor={script.color}
                  onPress={() =>
                    router.navigate({
                      pathname: "/(authenticated)/(script)/script-practice",
                      params: {
                        id: script.id,
                        color: script.color,
                      },
                    })
                  }
                />
              </View>
            </Animated.View>
          </Link.AppleZoomTarget>
        </View>

        {/* Rest of screen unchanged */}
        <View style={styles.scriptInfoContainer}>
          <View style={styles.slideCountContainer}>
            <View style={styles.numContainer}>
              <Host matchContents>
                <SwiftUIText
                  modifiers={[
                    font({ family: "Krona One", size: 94 }),
                    foregroundStyle(textTitleColor),
                    contentTransition("numericText"),
                    animation(Animation.spring(), cardCountNum1),
                  ]}
                >
                  {cardCountNum1}
                </SwiftUIText>
              </Host>
              <Host matchContents style={styles.num2}>
                <SwiftUIText
                  modifiers={[
                    font({ family: "Krona One", size: 94 }),
                    foregroundStyle(textTitleColor),
                    contentTransition("numericText", { countsDown: true }),
                    animation(Animation.spring(), cardCountNum2),
                  ]}
                >
                  {cardCountNum2}
                </SwiftUIText>
              </Host>
            </View>
            <Text style={[styles.cardsText, { color: textDarkColor }]}>
              Cards
            </Text>
          </View>
          <View style={styles.pillContainer}>
            <Pill
              color={script.color}
              variant="duration"
              durationMins={script.durationMins}
            />
            <Pill color={script.color} variant="date" date={script.updatedAt} />
          </View>
        </View>

        <View style={[styles.scriptContainer]}>
          <Text style={[styles.scriptHeaderText, { color: textDarkColor }]}>
            Script
          </Text>
          <Pressable
            style={[
              styles.scriptTextContainer,
              { backgroundColor: scriptCardColor },
            ]}
            onPress={() =>
              router.navigate({
                pathname: "/(authenticated)/(script)/script",
                params: { script: script.id, color: script.color },
              })
            }
          >
            <Text
              style={[styles.scriptText, { color: textDarkColor }]}
              numberOfLines={10}
            >
              {scriptText}
            </Text>
            <CtaButton
              label="View"
              accentColor={script.color}
              onPress={() =>
                router.navigate({
                  pathname: "/(authenticated)/(script)/script",
                  params: { script: script.id, color: script.color },
                })
              }
            />
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 24, paddingBottom: 48 },
  heroCard: {
    borderRadius: 77,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 14,
    position: "relative",
    zIndex: 9,
    top: 0,
    left: 0,
  },
  heroContent: { padding: 20, width: "80%", gap: 16 },
  heroTitle: { fontSize: 34, marginBottom: 10, fontFamily: "KronaOne" },
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#414141",
    alignSelf: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  ctaText: { fontSize: 36, fontFamily: "KronaOne" },
  scriptInfoContainer: {
    marginTop: 35,
    paddingHorizontal: 14,
    justifyContent: "space-between",
    flexDirection: "row",
  },
  numContainer: { flexDirection: "row" },
  num2: { transform: [{ translateY: 30 }, { translateX: -10 }] },
  slideCountContainer: {
    gap: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardsText: { fontFamily: "KronaOne", fontSize: 20 },
  pillContainer: { gap: 8, justifyContent: "space-between" },
  scriptContainer: {
    marginTop: 44,
    paddingHorizontal: 14,
    position: "relative",
    gap: 14,
  },
  scriptHeaderText: { fontFamily: "KronaOne", fontSize: 34 },
  scriptTextContainer: {
    paddingHorizontal: 44,
    paddingVertical: 34,
    borderRadius: 77,
    gap: 14,
  },
  scriptText: { fontSize: 20, fontWeight: "600" },
});
