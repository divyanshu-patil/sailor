import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { Host, ContentUnavailableView } from "@expo/ui/swift-ui";

import { useSavedDecks } from "@/hooks/use-saved-decks";
import { PublicDeck } from "@/services/public-deck.service";
import { SCREEN_PADDING } from "@/screens/presentation/decks/components/constants";
import { PublicDeckCard } from "./components/public-deck-card";

/**
 * Decks the user has bookmarked from Discover.
 *
 * The same grid and the same card as the feed — a saved deck is a public deck,
 * not a copy in the library, so it has no business looking different. Decks the
 * author has since unpublished simply aren't in the list.
 */
const SavedDecksScreen = () => {
  const { decks, isLoading, isRefreshing, error, refresh } = useSavedDecks();

  const renderItem = useCallback(
    ({ item, index }: { item: PublicDeck; index: number }) => (
      <PublicDeckCard deck={item} index={index} />
    ),
    [],
  );

  return (
    <View style={styles.screen}>
      <Stack.Title>Saved</Stack.Title>

      <FlashList
        data={decks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator />
            </View>
          ) : (
            <Host style={styles.placeholder}>
              <ContentUnavailableView
                title="Nothing saved yet"
                systemImage="bookmark"
                description={
                  error ??
                  "Decks you save from Discover show up here. They stay the author's — saving keeps a link, not a copy."
                }
              />
            </Host>
          )
        }
      />
    </View>
  );
};

export default SavedDecksScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: SCREEN_PADDING + 4,
    paddingTop: 8,
    paddingBottom: 40,
  },
  placeholder: { height: 320, justifyContent: "center", alignItems: "center" },
});
