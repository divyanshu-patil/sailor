import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
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
import { usePublicDeck } from "@/hooks/use-public-deck";
import { publicDeckService } from "@/services/public-deck.service";
import { fonts } from "@/constants/fonts";

import { haptics } from "@/lib/haptics";
import { parseBlocks, type Segment } from "@/utils/parseInlineMarkdown";

type ScriptDetailParams = {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: string;
  durationMins: string;
  isFavourite: string;
  /**
   * "1" when this deck came from Discover and belongs to someone else.
   *
   * The screen is the same either way — same hero, same card count, same script
   * card — because a public deck is a deck. What changes is where the data comes
   * from (the public endpoint, not the owner-only one) and what the toolbar
   * offers: Save instead of favourite/publish/delete.
   */
  public?: string;
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

  const isOtherPersonsDeck = params.public === "1";

  // Use initial data from params, then refresh from API. Skipped entirely for
  // someone else's deck: the owner endpoints would 404, and there is no local
  // row to read either.
  const {
    data: deck,
    script,
    isMutating: isDeleting,
    toggleFavourite,
    deleteDeck,
    unpublish,
  } = useDeck({
    deckId: isOtherPersonsDeck ? "" : paramScript.id,
    initialData: paramScript,
    immediate: !isOtherPersonsDeck,
  });

  const {
    data: publicDeck,
    script: publicScript,
    creatorName,
    isSaved,
    toggleSaved,
  } = usePublicDeck(isOtherPersonsDeck ? paramScript.id : null);

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
  useCards({
    deckId: paramScript.id,
    // Someone else's cards are read but never mirrored: the local `cards` table
    // is foreign-keyed to the user's own decks.
    local: !isOtherPersonsDeck,
  });

  // Use the fetched data if available, otherwise fall back to params
  const currentScript = publicDeck ?? deck ?? paramScript;
  const isFavourite = currentScript.isFavourite ?? false;

  const handleToggleFavourite = async () => {
    await toggleFavourite();
  };

  /**
   * Publishing lives here, in the deck's own menu, rather than on the brief that
   * generated it. A deck is something you decide to share *after* you've seen
   * it, and any deck can be shared — including ones written before the feed
   * existed. The brief-time toggle could do neither.
   */
  const isPublic = currentScript.isPublic ?? false;

  const handlePublish = () => {
    router.push({
      pathname: "/(authenticated)/(script)/modals/publish",
      params: { id: currentScript.id },
    });
  };

  /**
   * Unpublishing asks first. It's the one action here that changes what other
   * people can see, and it isn't obviously reversible from the outside — so it
   * gets the confirmation that the reversible actions (favourite, publish)
   * deliberately don't.
   */
  const handleUnpublish = () => {
    Alert.alert(
      "Remove from Discover?",
      "This deck stops appearing publicly. Its description, tags and category are kept, so you can publish it again without retyping them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            haptics.destroy();
            void unpublish();
          },
        },
      ],
    );
  };

  /**
   * Start practising.
   *
   * The `public` flag travels with it: the practice screen reads its cards from
   * the API instead of the local mirror, and records nothing to the author's
   * audio. Counting the run is fire-and-forget — social proof isn't worth
   * delaying the first card for.
   */
  const handlePractice = () => {
    if (isOtherPersonsDeck)
      void publicDeckService.recordPractice(currentScript.id);
    router.navigate({
      pathname: "/(authenticated)/(script)/script-practice",
      params: {
        id: currentScript.id,
        color: currentScript.color,
        ...(isOtherPersonsDeck ? { public: "1" } : {}),
      },
    });
  };

  /**
   * Delete the deck, behind a confirmation.
   *
   * This used to fire straight from the toolbar button, so one mis-tap next to
   * the practice and prompter actions destroyed the script, its cards and its
   * recording with nothing to undo it — and, unlike unpublishing above, nothing
   * to restore it from either. The deck's own title is in the prompt so the
   * answer is to *this* script rather than to a generic warning.
   */
  const handleDelete = () => {
    if (isDeleting) return;
    Alert.alert(
      "Delete this script?",
      `"${currentScript.title}" and its cards and recording will be deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            haptics.destroy();
            // Only leave the screen if the delete actually went through.
            // `!== undefined` was true for `false` as well, so a failed delete
            // still popped the screen and the deck reappeared in the grid a
            // moment later.
            if (await deleteDeck()) {
              router.back();
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    setTimeout(() => {
      const paddedSlideCount = currentScript.slideCount
        .toString()
        .padStart(2, "0");
      setCardCountNum1(Number(paddedSlideCount.charAt(0)));
      setCardCountNum2(Number(paddedSlideCount.charAt(1)));
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
  const scriptText = publicScript ?? script ?? "";
  // The same blocks the full script screen reads, so `## [HOOK]` headings,
  // **stress** and *delivery notes* aren't shown as raw markdown here.
  const scriptBlocks = useMemo(() => parseBlocks(scriptText), [scriptText]);

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
      {isOtherPersonsDeck ? (
        // A reader gets one action, and it isn't a copy: saving bookmarks the
        // author's deck, so it keeps their edits and disappears if they
        // unpublish. There is no favourite (that's for your own library), no
        // publish, and no delete on a deck you don't own.
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            variant="prominent"
            icon={isSaved ? "bookmark.fill" : "bookmark"}
            // The deck's own colour, in the darkened tone the rest of this
            // screen's text uses — the raw fill would sit on a background that
            // is that same colour lightened, and disappear into it.
            tintColor={textDarkColor}
            onPress={toggleSaved}
          />
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={isFavourite ? "heart.fill" : "heart"}
            tintColor={"#EB6B83"}
            onPress={handleToggleFavourite}
          />
          <Stack.Toolbar.Menu icon={"ellipsis"}>
            {isPublic ? (
              <Stack.Toolbar.Menu inline title="Discover">
                <Stack.Toolbar.MenuAction
                  icon={"square.and.pencil"}
                  onPress={handlePublish}
                >
                  Edit public details
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  destructive
                  icon={"eye.slash"}
                  onPress={handleUnpublish}
                >
                  Remove from Discover
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            ) : (
              <Stack.Toolbar.MenuAction icon={"globe"} onPress={handlePublish}>
                Publish to Discover
              </Stack.Toolbar.MenuAction>
            )}
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
      )}

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
                  onPress={handlePractice}
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

        {/*
          Who and how often — its own row, not a badge crammed into the hero.
          The hero card is the deck's identity and the GO button; attribution and
          social proof are facts *about* it, and they read as facts at this size
          instead of as fine print under the title.

          Only rendered when there's something public to say: a private deck of
          your own has no author to credit and no practice count worth a row.
        */}
        {(isOtherPersonsDeck || isPublic) && (
          <View style={styles.creditRow}>
            <StatChip
              color={currentScript.color}
              icon={isOtherPersonsDeck ? "account" : "earth"}
              label={
                isOtherPersonsDeck
                  ? (creatorName ?? "Anonymous")
                  : "In Discover"
              }
            />
            <StatChip
              color={currentScript.color}
              icon="fire"
              label={`${currentScript.practiceCount ?? 0}`}
            />
            {/* Saves, counted from the bookmarks themselves rather than a
                stored number — and it moves the moment the reader taps the
                bookmark in the toolbar. */}
            <StatChip
              color={currentScript.color}
              icon="bookmark"
              label={`${currentScript.saveCount ?? 0}`}
            />
          </View>
        )}

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
              {/* Nested spans inside the one Text, so the card still clamps to
                  ten lines with an ellipsis across block boundaries. */}
              {scriptBlocks.map((block, i) => (
                <Fragment key={i}>
                  {i > 0 && "\n\n"}
                  {block.type === "quote" ? (
                    block.lines.map((line, j) => (
                      <Fragment key={j}>
                        {j > 0 && "\n"}
                        <Spans segments={line} italic />
                      </Fragment>
                    ))
                  ) : (
                    <Spans
                      segments={block.segments}
                      bold={block.type === "heading"}
                    />
                  )}
                </Fragment>
              ))}
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

/** Inline markdown as nested Text spans, inheriting the parent's size and
 *  colour. `bold`/`italic` force the style for a whole heading or quote. */
const Spans = ({
  segments,
  bold,
  italic,
}: {
  segments: Segment[];
  bold?: boolean;
  italic?: boolean;
}) =>
  segments.map((segment, i) => (
    <Text
      key={i}
      style={[
        (bold || segment.bold) && styles.scriptBold,
        (italic || segment.italic) && styles.scriptItalic,
      ]}
    >
      {segment.text}
    </Text>
  ));

/**
 * A small fact about the deck: an icon in its own disc, then a value.
 *
 * The same tones `Pill` derives, one size down — this row sits under the big
 * duration and date pills and would compete with them at their scale.
 */
const StatChip = ({
  color,
  icon,
  label,
}: {
  color: string;
  icon: "account" | "earth" | "fire" | "bookmark";
  label: string;
}) => (
  <View
    style={[
      styles.statChip,
      { backgroundColor: colord(color).lighten(0.05).toHex() },
    ]}
  >
    <View
      style={[
        styles.statIcon,
        { backgroundColor: colord(color).darken(0.07).desaturate(0.2).toHex() },
      ]}
    >
      <MaterialDesignIcons
        name={icon}
        size={17}
        color={colord(color).darken(0.35).desaturate(0.5).toHex()}
      />
    </View>
    <Text
      style={[
        styles.statLabel,
        { color: colord(color).darken(0.25).desaturate(0.5).toHex() },
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </View>
);

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
  creditRow: {
    marginTop: 28,
    paddingHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 18,
    paddingVertical: 6,
    borderRadius: 100,
  },
  statIcon: {
    width: 32,
    aspectRatio: 1,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontFamily: fonts.krona, fontSize: 15 },
  heroTitle: { fontSize: 34, marginBottom: 10, fontFamily: fonts.krona },
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
  ctaText: { fontSize: 36, fontFamily: fonts.krona },
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
  cardsText: { fontFamily: fonts.krona, fontSize: 20 },
  pillContainer: { gap: 8, justifyContent: "space-between" },
  scriptContainer: {
    marginTop: 44,
    paddingHorizontal: 14,
    position: "relative",
    gap: 14,
  },
  scriptHeaderText: { fontFamily: fonts.krona, fontSize: 34 },
  scriptTextContainer: {
    paddingHorizontal: 44,
    paddingVertical: 34,
    borderRadius: 77,
    gap: 14,
  },
  scriptText: { fontSize: 20, fontWeight: "600" },
  scriptBold: { fontWeight: "800" },
  scriptItalic: { fontStyle: "italic" },
});
