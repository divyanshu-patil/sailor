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
import { DeckItem } from "@/services/deck.service";
import { useCards, useDeck } from "@/hooks";

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
      updatedAt: params.updatedAt,
      slideCount: Number(params.slideCount),
      durationMins: Number(params.durationMins),
      isFavourite:
        params.isFavourite != null ? JSON.parse(params.isFavourite) : false,
    }),
    [params],
  );

  // Use initial data from params, then refresh from API
  const {
    data: deck,
    script,
    isMutating: isDeleting,
    toggleFavourite,
    deleteDeck,
  } = useDeck({
    deckId: paramScript.id,
    initialData: paramScript,
  });

  /**
   * Pull the deck's cards into the local mirror.
   *
   * Nothing on this screen renders them directly, but this was the only place a
   * deck gets opened and nothing ever fetched them — `useCards` was wired into
   * practice mode alone, so a deck the user never practised had no cards on
   * disk at all. That's what made "cards aren't storing locally" true, and it
   * also quietly broke search: `searchDecks` ranks matches against the local
   * `cards` table, so a deck could never be found by a card's title.
   */
  useCards({ deckId: paramScript.id });

  // Use the fetched data if available, otherwise fall back to params
  const currentScript = deck ?? paramScript;
  const isFavourite = currentScript.isFavourite ?? false;

  const handleToggleFavourite = async () => {
    await toggleFavourite();
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    // Only leave the screen if the delete actually went through. `!== undefined`
    // was true for `false` as well, so a failed delete still popped the screen
    // and the deck reappeared in the grid a moment later.
    if (await deleteDeck()) {
      router.back();
    }
  };

  useEffect(() => {
    setTimeout(() => {
      setCardCountNum1(Number(currentScript.slideCount.toString().charAt(0)));
      setCardCountNum2(Number(currentScript.slideCount.toString().charAt(1)));
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
  }, [
    cardRotate,
    cardScale,
    currentScript.slideCount,
    shadowOffsetX,
    shadowOffsetY,
  ]);

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

  // The deck's real script, from SQLite via useDeck. This was a hardcoded
  // paragraph about I/O systems that every deck displayed regardless of what it
  // was actually about.
  const scriptText = script ?? "";

  const textDarkColor = colord(currentScript.color)
    .darken(0.35)
    .desaturate(0.5)
    .toHex();
  const textTitleColor = colord(currentScript.color)
    .darken(0.25)
    .desaturate(0.6)
    .toHex();
  const cardColor = currentScript.color;
  const scriptCardColor = currentScript.color;
  const screenColor = colord(currentScript.color).lighten(0.18).toHex();

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
        <Stack.Toolbar.Menu icon={"ellipsis"}>
          <Stack.Toolbar.MenuAction icon={"square.and.arrow.up"}>
            Share
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            destructive
            icon={"trash"}
            onPress={handleDelete}
          >
            Delete
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
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
                  {currentScript.title}
                </Text>
                <CtaButton
                  label="GO"
                  accentColor={currentScript.color}
                  onPress={() =>
                    router.navigate({
                      pathname: "/(authenticated)/(script)/script-practice",
                      params: {
                        id: currentScript.id,
                        color: currentScript.color,
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
              color={currentScript.color}
              variant="duration"
              durationMins={currentScript.durationMins}
            />
            <Pill
              color={currentScript.color}
              variant="date"
              // updatedAt is an ISO string end-to-end now; Pill formats a Date,
              // so the conversion happens here, at the point of display.
              date={new Date(currentScript.updatedAt)}
            />
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
                params: {
                  script: currentScript.id,
                  color: currentScript.color,
                },
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
              accentColor={currentScript.color}
              onPress={() =>
                router.navigate({
                  pathname: "/(authenticated)/(script)/script",
                  params: {
                    script: currentScript.id,
                    color: currentScript.color,
                  },
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
