import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Icon from "@react-native-vector-icons/lucide";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Attachment } from "@/types/presentation";
import CircularProgress from "./CircularProgress";

export const TILE_SIZE = 96;
/** Tiles fan out of one another instead of queueing up in a row. */
const OVERLAP = 18;
/** Cycled by index, so a stack never reads as a straight line. */
const ROTATIONS = ["-7deg", "4deg", "-4deg", "8deg"];
/** Room for the rotation and the remove badge to overhang the tiles. */
const BLEED = 16;

interface AttachmentStackProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  /** Failed uploads retry on tap — the tile is the only affordance there is. */
  onRetry: (id: string) => void;
}

/** Total tiles, so a tile knows where it sits in the pile. */

const Tile = memo(
  ({
    item,
    index,
    count,
    onRemove,
    onRetry,
  }: {
    item: Attachment;
    index: number;
    count: number;
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
  }) => {
    const isImage = item.kind === "image" && !!item.uri;
    const uploading = item.status === "uploading";
    const failed = item.status === "failed";

    return (
      <Animated.View
        entering={FadeIn.springify().damping(70)}
        exiting={FadeOut.duration(140)}
        layout={LinearTransition.springify().damping(70)}
        style={[
          styles.tileWrap,
          {
            transform: [{ rotate: ROTATIONS[index % ROTATIONS.length] }],
            marginLeft: index === 0 ? 0 : -OVERLAP,
            // Earlier tiles sit on top. A tile is only ever overlapped on its
            // left edge, so stacking this way leaves every remove badge — which
            // lives on the right — clear of the tile that follows it.
            zIndex: count - index,
          },
        ]}
      >
        <Pressable
          onPress={failed ? () => onRetry(item.id) : undefined}
          style={styles.tile}
        >
          {isImage ? (
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={uploading ? 10 : 0}
              transition={150}
            />
          ) : (
            <View style={styles.doc}>
              <Icon name="file-text" size={26} color="#8A4747" />
              <Text numberOfLines={2} style={styles.docName}>
                {item.name}
              </Text>
            </View>
          )}

          {uploading && (
            <View style={styles.overlay}>
              <CircularProgress
                progress={item.progress}
                size={30}
                color="#FFFFFF"
                trackColor="rgba(255,255,255,0.35)"
              />
            </View>
          )}

          {failed && (
            <View style={styles.overlay}>
              <Icon name="rotate-cw" size={22} color="#FFFFFF" />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => onRemove(item.id)}
          hitSlop={10}
          style={styles.removeBadge}
        >
          <Icon name="x" size={13} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    );
  },
);
Tile.displayName = "Tile";

/**
 * The attached files, fanned out like a handful of photos dropped on the table.
 * A short pile centres itself; once it outgrows the screen the row scrolls
 * sideways, so the composer below never moves.
 */
export default function AttachmentStack({
  attachments,
  onRemove,
  onRetry,
}: AttachmentStackProps) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Explicit height, and it is load-bearing: a horizontal ScrollView lays
      // its children out in a separate content view, so Yoga has nothing to
      // measure the scroller itself against and it collapses to zero.
      style={styles.scroller}
      // flexGrow lets a short pile centre itself while a long one still scrolls.
      contentContainerStyle={styles.content}
    >
      {attachments.map((item, i) => (
        <Tile
          key={item.id}
          item={item}
          index={i}
          count={attachments.length}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { height: TILE_SIZE + BLEED * 2, flexGrow: 0 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: BLEED,
  },
  tileWrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  tile: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#F0A0A0",
  },
  doc: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 8,
  },
  docName: {
    fontSize: 10,
    textAlign: "center",
    color: "#5C3232",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  removeBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1B1B1B",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
