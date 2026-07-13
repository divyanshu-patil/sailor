import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";

import { Card } from "./Card";
import { COLUMN_GAP, SCREEN_PADDING } from "./constants";
import { DeckItem } from "@/services/deck.debug.service";
import { useDecks } from "@/hooks";
import {
  useFocusEffect,
  useHeaderHeight,
} from "expo-router/build/react-navigation";
// import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs";

const AllScriptsScreen = () => {
  const headerHeight = useHeaderHeight();
  // const bottomTabHeight = useBottomTabBarHeight();
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
    onError: () => {
      // Error is handled by the hook
    },
  });

  const renderItem: ListRenderItem<DeckItem> = useCallback(
    ({ item, index }) => <Card item={item} index={index} />,
    [],
  );

  if (isLoading || !hasActivated) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator />
      </View>
    );
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
    <View style={[styles.screen]}>
      <FlashList
        data={decks ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        masonry
        numColumns={2}
        optimizeItemArrangement
        contentContainerStyle={[
          styles.screenContent,
          { paddingTop: headerHeight, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
};

export default AllScriptsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingBottom: 24,
    paddingTop: 24,
  },
});
