// screens/presentation/decks/all-scripts.tsx (or wherever this file lives)
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
  type ListRenderItem,
} from "@shopify/flash-list";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useDerivedValue,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { router, Stack } from "expo-router";

import { Card } from "../components/Card";
import { COLUMN_GAP, SCREEN_PADDING } from "../components/constants";
import { DeckItem } from "@/services/deck.service";
import { NO_DECKS_MASCOT, PULL_TO_REFRESH_MASCOT } from "@/constants/mascots";
import SkiaMascot from "@/components/ui/skia-mascot";
import { LottieMascot } from "@/screens/daily-practice/components/Mascot";
import {
  useDecks,
  filterAndSortDecks,
  type DeckFilterType,
  type DeckSortOption,
} from "@/hooks/use-decks";
import {
  useFocusEffect,
  useHeaderHeight,
} from "expo-router/build/react-navigation";
import ShimmerBar from "@/components/ui/shared/shimmer-bar";

const PULL_DISTANCE_FOR_FULL_OPACITY = 150;
const SHIMMER_BAR_HEIGHT = 5;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as ForwardRefExoticComponent<
  FlashListProps<DeckItem> & RefAttributes<FlashListRef<DeckItem>>
>;

const AllScriptsScreen = () => {
  const headerHeight = useHeaderHeight();
  const [hasActivated, setHasActivated] = useState(false);
  const [filter, setFilter] = useState<DeckFilterType>("all");
  const [sort, setSort] = useState<DeckSortOption>("dateCreated");
  const listRef = useRef<FlashListRef<DeckItem>>(null);

  useFocusEffect(
    useCallback(() => {
      setHasActivated(true);
    }, []),
  );

  const {
    data: decks,
    isLoading,
    isRefreshing,
    error,
    refresh: onRefresh,
  } = useDecks({
    onError: () => {},
  });

  const displayedDecks = useMemo(
    () => filterAndSortDecks(decks ?? [], filter, sort),
    [decks, filter, sort],
  );

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const restOffset = -headerHeight;
  const pullOffset = -(headerHeight + PULL_DISTANCE_FOR_FULL_OPACITY);

  // Purely a function of the scroll position now — no refreshing branch at all.
  // The mascot belongs to the pull gesture and nothing else: it grows under the
  // finger and collapses back to 0 as the list springs home on release, at which
  // point the shimmer bar takes over as the only sign that a load is running.
  // Anything that held this open during the refresh had to jump to that held
  // height the instant the refresh began, which was the flicker.
  const mascotContainerStyle = useAnimatedStyle(() => ({
    opacity: 1,
    height: Math.max(0, restOffset - scrollY.value),
  }));

  // The pull scrubs the mascot's timeline: forward as the finger drags down,
  // back again as the list springs home on release.
  // Quintic: crawls through most of the pull, then rushes to the end.
  const pullProgress = useDerivedValue(() =>
    Easing.poly(2)(
      interpolate(
        scrollY.value,
        [pullOffset, restOffset],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    ),
  );

  /**
   * No layout animation wrapper.
   *
   * `LinearTransition` + `FadeIn`/`FadeOut` around a recycled cell animates
   * on recycle, not just on insert: every row scrolled into view started a
   * spring on its own position while the list was moving. The card's own
   * entrance (once per cell) is the only animation left here, and scrolling
   * is smooth again. Filter and sort changes now swap instantly instead of
   * cross-fading — the cheaper trade.
   */
  const renderItem: ListRenderItem<DeckItem> = useCallback(
    ({ item, index }) => <Card item={item} index={index} />,
    [],
  );

  if (!hasActivated) {
    return <View style={[styles.screen, styles.centered]} />;
  }

  if (error && (!decks || decks.length === 0)) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.messageText}>{error}</Text>
      </View>
    );
  }

  if (!decks || decks.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <LottieMascot mascot={NO_DECKS_MASCOT} size={180} />
        <Text style={styles.messageText}>No scripts yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="right">
        {/* Saved decks are other people's, so they don't belong in this grid —
            but this is where the user comes looking for "my decks", so the way
            in belongs here too. */}
        <Stack.Toolbar.Button
          variant="prominent"
          icon="bookmark"
          onPress={() => router.push("/(authenticated)/discover/saved")}
        />
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
          <Stack.Toolbar.Menu inline title="Filter">
            <Stack.Toolbar.MenuAction
              isOn={filter === "all"}
              onPress={() => setFilter("all")}
            >
              All decks
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filter === "favourites"}
              onPress={() => setFilter("favourites")}
            >
              Favourites
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>

          <Stack.Toolbar.Menu inline title="Sort by">
            <Stack.Toolbar.MenuAction
              isOn={sort === "dateCreated"}
              onPress={() => setSort("dateCreated")}
            >
              Date created
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sort === "nameAsc"}
              onPress={() => setSort("nameAsc")}
            >
              Name (A-Z)
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sort === "nameDesc"}
              onPress={() => setSort("nameDesc")}
            >
              Name (Z-A)
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sort === "duration"}
              onPress={() => setSort("duration")}
            >
              Duration
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sort === "cardCount"}
              onPress={() => setSort("cardCount")}
            >
              Number of cards
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.mascotContainer,
          { top: headerHeight, backgroundColor: "#C1D8EB" },
          mascotContainerStyle,
        ]}
      >
        <SkiaMascot
          source={PULL_TO_REFRESH_MASCOT.source}
          progress={pullProgress}
          width={98}
        />
      </Animated.View>

      <AnimatedFlashList
        ref={listRef}
        data={displayedDecks}
        keyExtractor={(item: DeckItem) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          isLoading || isRefreshing ? (
            <ShimmerBar height={SHIMMER_BAR_HEIGHT} color={"#A0C4E2"} />
          ) : null
        }
        ListHeaderComponentStyle={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
        masonry
        numColumns={2}
        optimizeItemArrangement
        maintainVisibleContentPosition={{ disabled: true }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.screenContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            // Never held open. `refreshing` is what keeps the control — and the
            // ~60px of content inset under it — pinned down for the length of
            // the request, which would leave an empty gap where the mascot used
            // to be. Pinned to false, the list springs straight back on release
            // (so the mascot's height reaches 0) while `onRefresh` still fires
            // on the pull. The shimmer bar reports the load from there.
            refreshing={false}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            progressViewOffset={headerHeight}
          />
        }
      />
    </View>
  );
};

export default AllScriptsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  messageText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  mascotContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 1,
  },
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingBottom: 24,
    paddingTop: 24,
    position: "relative",
    zIndex: 2,
  },
});
