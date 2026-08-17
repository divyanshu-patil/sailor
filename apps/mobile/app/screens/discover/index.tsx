import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Host, ContentUnavailableView } from "@expo/ui/swift-ui";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { usePublicDecks } from "@/hooks";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { PublicDeck, PublicDeckSort } from "@/services/public-deck.service";
import { DECK_CATEGORIES } from "@/constants/deck-categories";
import { fonts } from "@/constants/fonts";
import { SCREEN_PADDING } from "@/screens/presentation/decks/components/constants";
import { PublicDeckCard } from "./components/public-deck-card";
import { CategoryChips } from "./components/category-chips";

/**
 * Discover — every published deck in the app.
 *
 * Lives outside the `(tabs)` group on purpose: browsing other people's decks is
 * a mode, not a tab, and the tab bar competing with the bottom search toolbar
 * would put two pieces of floating chrome on the same 60 points of screen.
 *
 * Search, category and sort all run on the server (see usePublicDecks) rather
 * than filtering a page in memory — a client-side filter over one loaded page
 * is a filter over 20 decks, which stops being the truth the moment there are
 * 21.
 */
const DiscoverScreen = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<PublicDeckSort>("recent");

  // Every keystroke would otherwise be a request. 220ms is long enough to type
  // through and short enough that the results feel attached to the typing.
  const debouncedQuery = useDebouncedValue(query, 220);

  const {
    decks,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    refresh,
    loadMore,
  } = usePublicDecks({ q: debouncedQuery, category, sort });

  const renderItem = useCallback(
    ({ item, index }: { item: PublicDeck; index: number }) => (
      <PublicDeckCard deck={item} index={index} />
    ),
    [],
  );

  const header = useMemo(
    () => <CategoryChips selected={category} onSelect={setCategory} />,
    [category],
  );

  const hasFilters = !!category || debouncedQuery.trim().length > 0;

  return (
    <View style={styles.screen}>
      <Stack.Title>Discover</Stack.Title>

      {/*
        placement="automatic" + the SearchBarSlot below is what puts the field
        in the floating bottom toolbar on iOS 26, and falls back to the classic
        header search bar on older versions with no Platform.Version check.
      */}
      <Stack.SearchBar
        placement="automatic"
        placeholder="Search public decks"
        hideWhenScrolling={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery("")}
      />

      {/* Filter and sort live in the header; the bottom bar carries only the
          search field. Two menus competing with the search pill for the same
          floating strip left none of the three a comfortable tap target. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
          <Stack.Toolbar.Menu inline title="Category">
            <Stack.Toolbar.MenuAction
              isOn={category === null}
              onPress={() => setCategory(null)}
            >
              All categories
            </Stack.Toolbar.MenuAction>
            {DECK_CATEGORIES.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.value}
                icon={option.symbol}
                isOn={category === option.value}
                onPress={() => setCategory(option.value)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>

          <Stack.Toolbar.Menu inline title="Sort by">
            <Stack.Toolbar.MenuAction
              icon="sparkles"
              isOn={sort === "recent"}
              onPress={() => setSort("recent")}
            >
              Newest
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="flame"
              isOn={sort === "popular"}
              onPress={() => setSort("popular")}
            >
              Most practised
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="clock"
              isOn={sort === "duration"}
              onPress={() => setSort("duration")}
            >
              Longest
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {/*
        One scroll view, always mounted.

        Both of the previous states — a spinner while loading, an empty view
        when a filter matched nothing — replaced the list wholesale, which took
        the category chips down with them: selecting a chip that had no results
        removed the row you'd just tapped, leaving no way back. The chips are
        the list header and the empty state is ListEmptyComponent, so filtering
        only ever changes the cards.

        Keeping the FlashList as the screen's first native view is also what
        lets the large title collapse against it (see the toolbar note below).
      */}
      <FlashList
        data={decks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={refresh}
        // Half a screen of runway: the next page is already arriving by the
        // time the user reaches the bottom, so the grid never stalls.
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator />
            </View>
          ) : (
            <Host style={styles.placeholder}>
              <ContentUnavailableView
                title={hasFilters ? "No decks match" : "Nothing published yet"}
                systemImage={hasFilters ? "magnifyingglass" : "sparkles"}
                description={
                  error ??
                  (hasFilters
                    ? "Try a different search or category."
                    : "Published decks from everyone show up here.")
                }
              />
            </Host>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      {/*
        Rendered *after* the list, and that order matters: the bottom toolbar is
        a real native view, and iOS finds the scroll view the large title
        collapses against by walking the first-child chain. With the toolbar
        first, that walk hit the toolbar instead of the list — so the title got
        no scroll view to attach to and just floated over the grid.
      */}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
      </Stack.Toolbar>

      {/* Errors while decks are already on screen are non-blocking: the list
          stays, and this says why it stopped growing. */}
      {error && decks.length > 0 ? (
        <Animated.View
          style={styles.errorBar}
          entering={FadeIn}
          layout={LinearTransition}
        >
          <GlassView
            style={styles.errorGlass}
            glassEffectStyle={isLiquidGlassAvailable() ? "regular" : "none"}
          >
            <Text style={styles.errorText}>{error}</Text>
          </GlassView>
        </Animated.View>
      ) : null}
    </View>
  );
};

export default DiscoverScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Not flex:1 — this sits inside the list, which has no height of its own to
  // divide up. A fixed block keeps it centred under the chips either way.
  placeholder: {
    height: 320,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: SCREEN_PADDING + 4,
    paddingTop: 8,
    // Clears the floating bottom toolbar — content scrolls *under* translucent
    // chrome, but must be able to come out from behind it.
    paddingBottom: 120,
  },
  footer: { paddingVertical: 24 },
  errorBar: { position: "absolute", left: 16, right: 16, bottom: 110 },
  errorGlass: {
    borderRadius: 18,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.alanSans.medium, fontSize: 13 },
});
