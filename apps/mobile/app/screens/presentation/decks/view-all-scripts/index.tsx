import { ComponentType, useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  FlashList,
  type FlashListProps,
  type ListRenderItem,
} from "@shopify/flash-list";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Image } from "expo-image";

import { Card } from "../components/Card";
import { COLUMN_GAP, SCREEN_PADDING } from "../components/constants";
import { DeckItem } from "@/services/deck.debug.service";
import { useDecks } from "@/hooks";
import {
  useFocusEffect,
  useHeaderHeight,
} from "expo-router/build/react-navigation";
import ShimmerBar from "@/components/ui/shared/shimmer-bar";

// const MASCOT_AREA_HEIGHT = 90;
const PULL_DISTANCE_FOR_FULL_OPACITY = 80; // px of pull needed to reach full reveal
const SHIMMER_BAR_HEIGHT = 5;

// Re-assert the generic type Reanimated's wrapper erases
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as ComponentType<FlashListProps<DeckItem>>;
const AnimatedImage = Animated.createAnimatedComponent(Image);

const AllScriptsScreen = () => {
  const headerHeight = useHeaderHeight();
  const [hasActivated, setHasActivated] = useState(false);

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

  // Shared values live on the UI thread — no bridge hops per scroll frame
  const scrollY = useSharedValue(0);
  const isRefreshingShared = useSharedValue(0);

  // Mirror the JS-thread `isRefreshing` boolean into a UI-thread shared value
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
      // opacity: isRefreshingShared.value ? 1 : opacity,
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
        <Text style={styles.messageText}>No scripts yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
        data={decks ?? []}
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
        scrollEnabled={!isRefreshing}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.screenContent, { paddingBottom: 100 }]}
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
