// screens/presentation/decks/all-scripts.tsx (or wherever this file lives)
import {
  ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
  type ListRenderItem,
} from "@shopify/flash-list";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Stack } from "expo-router";

import { Card } from "../components/Card";
import { COLUMN_GAP, SCREEN_PADDING } from "../components/constants";
import { DeckItem } from "@/services/deck.debug.service";
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

const PULL_DISTANCE_FOR_FULL_OPACITY = 80;
const SHIMMER_BAR_HEIGHT = 5;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as ForwardRefExoticComponent<
  FlashListProps<DeckItem> & RefAttributes<FlashListRef<DeckItem>>
>;
const AnimatedImage = Animated.createAnimatedComponent(Image);

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
  const isRefreshingShared = useSharedValue(0);

  useEffect(() => {
    isRefreshingShared.value = isRefreshing ? 1 : 0;
  }, [isRefreshing, isRefreshingShared]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const restOffset = -headerHeight;
  const pullOffset = -(headerHeight + PULL_DISTANCE_FOR_FULL_OPACITY);

  const mascotContainerStyle = useAnimatedStyle(() => {
    const pulled = restOffset - scrollY.value;
    const height = Math.max(0, pulled);

    return {
      opacity: 1,
      height: isRefreshingShared.value
        ? PULL_DISTANCE_FOR_FULL_OPACITY
        : height,
    };
  });

  const mascotImageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [pullOffset, restOffset],
      [1, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale: isRefreshingShared.value ? 1 : scale }],
      transformOrigin: ["50%", "100%", 0],
    };
  });

  const renderItem: ListRenderItem<DeckItem> = useCallback(
    ({ item, index }) => (
      <Animated.View
        layout={LinearTransition.springify().damping(100)}
        entering={FadeIn}
        exiting={FadeOut}
      >
        <Card item={item} index={index} />
      </Animated.View>
    ),
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
        <Text style={styles.messageText}>No scripts yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="right">
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
        <AnimatedImage
          source={require("@/assets/smiling.svg")}
          style={[{ width: 98, height: 98 }, mascotImageStyle]}
        />
      </Animated.View>

      <AnimatedFlashList
        ref={listRef}
        data={displayedDecks}
        keyExtractor={(item: DeckItem) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          isLoading ? (
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
        scrollEnabled={!isRefreshing}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.screenContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
