import {
  useCallback,
  useMemo,
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
import { DeckItem } from "@/services/deck.debug.service";
import { useDecks } from "@/hooks";
import ShimmerBar from "@/components/ui/shared/shimmer-bar";
import StartSearchingState from "./start-searching.state";
import NoResultsFoundState from "./no-results.state";

const SHIMMER_BAR_HEIGHT = 5;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as ForwardRefExoticComponent<
  FlashListProps<DeckItem> & RefAttributes<FlashListRef<DeckItem>>
>;
type FilterType = "exactTitle" | "script";
type SortOption =
  | "dateCreated"
  | "nameAsc"
  | "nameDesc"
  | "duration"
  | "cardCount";

type SearchResult = DeckItem & {
  matchType: "title" | "script" | "fuzzy";
};

/* --------------------------------------------------------------------- *
 * Placeholder search functions
 *
 * These currently run against the in-memory `decks` array from useDecks
 * and only compare against the deck title. Once local storage (SQLite /
 * WatermelonDB / etc.) is wired up, swap the internals below to query the
 * DB directly instead of filtering an array — function signatures and
 * return shape can stay the same so the screen doesn't need to change.
 * --------------------------------------------------------------------- */

/**
 * Exact / substring match against the deck title.
 * TODO: replace with a real query once local DB exists,
 * e.g. `SELECT * FROM decks WHERE title LIKE '%query%'`.
 */
function searchByTitle(query: string, decks: DeckItem[]): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return decks
    .filter((deck) => deck.title.toLowerCase().includes(q))
    .map((deck) => ({ ...deck, matchType: "title" as const }));
}

/**
 * Placeholder for matching against a deck's actual slide/script content
 * rather than just its title.
 * TODO: implement once scripts are stored locally — will likely need its
 * own indexed table (deckId -> slide text) to search efficiently.
 */
function searchByScript(_query: string, _decks: DeckItem[]): SearchResult[] {
  return [];
}

/**
 * Placeholder for fuzzy matching (e.g. Fuse.js, trigram similarity, etc.)
 * against title and/or script content.
 * TODO: implement fuzzy scoring + a match threshold once local DB is in place.
 */
function searchFuzzy(_query: string, _decks: DeckItem[]): SearchResult[] {
  return [];
}

/**
 * Single entry point the screen calls. Combines whichever strategies are
 * relevant for the active filter into one de-duplicated array — all match
 * types render through the same list/card, so this is the only seam the
 * UI needs to know about.
 */
function searchDecks(
  query: string,
  decks: DeckItem[],
  filter: FilterType,
): SearchResult[] {
  if (!query.trim()) return [];

  let results: SearchResult[] = [];

  if (filter === "exactTitle") {
    results = results.concat(searchByTitle(query, decks));
    // Once fuzzy matching exists, exact-title mode could still layer it in:
    // results = results.concat(searchFuzzy(query, decks));
  }

  if (filter === "script") {
    results = results.concat(searchByScript(query, decks));
  }

  const seen = new Set<string>();
  return results.filter((deck) => {
    if (seen.has(deck.id)) return false;
    seen.add(deck.id);
    return true;
  });
}

function sortDecks(decks: SearchResult[], sort: SortOption): SearchResult[] {
  const sorted = [...decks];

  switch (sort) {
    case "nameAsc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "nameDesc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "duration":
      return sorted.sort((a, b) => b.durationMins - a.durationMins);
    case "cardCount":
      return sorted.sort((a, b) => b.slideCount - a.slideCount);
    case "dateCreated":
    default:
      return sorted.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
  }
}

const SearchScreen = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("exactTitle");
  const [sort, setSort] = useState<SortOption>("dateCreated");
  const listRef = useRef<FlashListRef<DeckItem>>(null);

  const { data: decks, isLoading } = useDecks({ onError: () => {} });

  const results = useMemo(() => {
    const matched = searchDecks(query, decks ?? [], filter);
    return sortDecks(matched, sort);
  }, [query, decks, filter, sort]);

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

  const hasQuery = query.trim().length > 0;

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
        onChangeText={(text) => setQuery(text.nativeEvent.text)}
      />

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
          <Stack.Toolbar.Menu inline title="Filter">
            <Stack.Toolbar.MenuAction
              isOn={filter === "exactTitle"}
              onPress={() => setFilter("exactTitle")}
            >
              Exact title match
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filter === "script"}
              onPress={() => setFilter("script")}
            >
              Script match
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

      {isLoading ? (
        <ShimmerBar height={SHIMMER_BAR_HEIGHT} color={"#A0C4E2"} />
      ) : null}

      {!hasQuery ? (
        <StartSearchingState />
      ) : results.length === 0 ? (
        <NoResultsFoundState query={query} />
      ) : (
        <AnimatedFlashList
          ref={listRef}
          data={results}
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
