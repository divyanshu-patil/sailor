import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router, Stack } from "expo-router";
import { NO_SAVED_DECKS_MASCOT } from "@/constants/mascots";
import { LottieMascot } from "@/screens/daily-practice/components/Mascot";

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
      {/* Same as Discover: first screen of its own stack, so there's no native
          back button to inherit. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.backward" onPress={router.back} />
      </Stack.Toolbar>

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
            <View style={styles.empty}>
              <LottieMascot mascot={NO_SAVED_DECKS_MASCOT} size={180} />
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>
                {error ?? "Decks you save from Discover show up here."}
              </Text>
            </View>
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
  empty: { paddingTop: 80, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
    opacity: 0.6,
  },
});
