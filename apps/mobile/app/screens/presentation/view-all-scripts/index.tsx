import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";

import { Card } from "./Card";
import { COLUMN_GAP, SCREEN_PADDING } from "./constants";
import { DeckItem } from "@/services/deck.service";
import { DATA } from "@/services/deck";

const AllScriptsScreen = () => {
  const renderItem: ListRenderItem<DeckItem> = useCallback(
    ({ item, index }) => <Card item={item} index={index} />,
    [],
  );

  return (
    <View style={styles.screen}>
      <FlashList
        data={DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        masonry
        numColumns={2}
        optimizeItemArrangement
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default AllScriptsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingBottom: 24,
    paddingTop: 24,
  },
});
