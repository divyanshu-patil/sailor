import {
  useCallback,
  useEffect,
  useRef,
  useState,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import { StyleSheet, View } from "react-native";
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
  type ListRenderItem,
} from "@shopify/flash-list";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Stack } from "expo-router";

import { Card } from "../components/Card";
import { COLUMN_GAP, SCREEN_PADDING } from "../components/constants";
import { DeckItem } from "@/services/deck.service";
import { useDecks } from "@/hooks";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  DeckSearchResult,
  DeckSortOption,
  searchDecks as dbSearchDecks,
} from "@/db/decks.repo";
import StartSearchingState from "./start-searching.state";
import NoResultsFoundState from "./no-results.state";

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as ForwardRefExoticComponent<
  FlashListProps<DeckItem> & RefAttributes<FlashListRef<DeckItem>>
>;
type FilterType = "all" | "titleOnly";
type SortOption = DeckSortOption;

/**
 * Search runs in SQLite, not over an in-memory array.
 *
 * `searchDecks` in db/decks.repo does the whole thing in one ranked query:
 * title beats description beats script beats card title, a deck that matches
 * several ways collapses to its strongest match, and sorting happens in SQL. The
 * old version could only ever match titles — script and fuzzy search were
 * stubs returning `[]` — because the script text simply wasn't on the device.
 */
const SearchScreen = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortOption>("dateCreated");
  const [results, setResults] = useState<DeckSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const listRef = useRef<FlashListRef<DeckItem>>(null);

  // Still mounted for its side effect: it refreshes decks from the API into
  // SQLite, which is what the query below reads.
  const { isRefreshing } = useDecks({ onError: () => {} });

  // Typing fires a query per keystroke otherwise, and a LIKE over every script
  // body is the one query here that's actually worth debouncing.
  const debouncedQuery = useDebouncedValue(query, 180);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    // Nothing typed: there's no state to clear, because `results` is only read
    // through `visibleResults` below, which is empty whenever the query is.
    if (!trimmed) return;

    let active = true;

    dbSearchDecks(trimmed, sort)
      .then((rows) => {
        if (!active) return;
        // "Title only" narrows the same ranked result set rather than running a
        // second query — the rank already records how each deck matched.
        setResults(
          filter === "titleOnly"
            ? rows.filter((row) => row.matchType === "title")
            : rows,
        );
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setIsSearching(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, filter, sort]);

  const hasQuery = query.trim().length > 0;

  // Derived, not stored. The query clearing has to blank the list on the same
  // frame — waiting for the debounce and an async round trip to write `[]` would
  // leave the previous results on screen behind an empty search box.
  const visibleResults = hasQuery ? results : [];

  // No progress bar: a local SQLite query returns in single-digit milliseconds,
  // so a loading indicator on top of the search field only ever flickered. This
  // now exists solely to hold the "nothing found" art back until the query has
  // actually run.
  const isLoading = (isSearching && hasQuery) || isRefreshing;

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

  return (
    <View style={styles.screen}>
      <Stack.Title>Search</Stack.Title>

      {/*
        placement="automatic" is what gives you reverse compatibility for
        free: on iOS 26+, with the NativeTabs "search" role trigger, this
        renders as the bottom tab-bar search field (the pill in your
        screenshot). On iOS <=18 / <=25, where that bottom search field
        doesn't exist, it automatically falls back to the classic header
        search bar with the native Cancel button — no Platform.Version
        checks needed.
      */}
      <Stack.SearchBar
        placement="automatic"
        placeholder="Search scripts"
        hideNavigationBar={false}
        onChangeText={(text) => {
          const next = text.nativeEvent.text;
          setQuery(next);
          // Flagged here, on the event, rather than in the effect: the effect
          // is debounced, so setting it there would leave the empty state
          // flashing for 180ms while the query is already stale.
          setIsSearching(next.trim().length > 0);
        }}
      />

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
          <Stack.Toolbar.Menu inline title="Search in">
            <Stack.Toolbar.MenuAction
              isOn={filter === "all"}
              onPress={() => setFilter("all")}
            >
              Everything
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filter === "titleOnly"}
              onPress={() => setFilter("titleOnly")}
            >
              Titles only
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

      {!hasQuery ? (
        <StartSearchingState />
      ) : visibleResults.length === 0 ? (
        // Held back until the query has actually run, so the "nothing found" art
        // doesn't flash between keystrokes while results are still coming.
        isLoading ? null : (
          <NoResultsFoundState query={query} />
        )
      ) : (
        <AnimatedFlashList
          ref={listRef}
          data={visibleResults}
          keyExtractor={(item: DeckItem) => item.id}
          renderItem={renderItem}
          masonry
          numColumns={2}
          optimizeItemArrangement
          maintainVisibleContentPosition={{ disabled: true }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.screenContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default SearchScreen;

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
    color: "#3C3C43",
  },
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingTop: 16,
    paddingBottom: 24,
  },
});
