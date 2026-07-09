import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";

import { Card } from "./Card";
import { COLUMN_GAP, SCREEN_PADDING } from "./constants";
import { DeckItem, deckService } from "@/services/deck.debug.service";

const AllScriptsScreen = () => {
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    try {
      setError(null);
      const data = await deckService.getDecks();
      setDecks(data);
    } catch {
      setError("Couldn't load your scripts. Pull to try again.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchDecks();
      setIsLoading(false);
    })();
  }, [fetchDecks]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchDecks();
    setIsRefreshing(false);
  }, [fetchDecks]);

  const renderItem: ListRenderItem<DeckItem> = useCallback(
    ({ item, index }) => <Card item={item} index={index} />,
    [],
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && decks.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.messageText}>{error}</Text>
      </View>
    );
  }

  if (decks.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.messageText}>No scripts yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlashList
        data={decks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        masonry
        numColumns={2}
        optimizeItemArrangement
        contentContainerStyle={styles.screenContent}
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
