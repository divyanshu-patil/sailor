import { memo, useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Icon from "@react-native-vector-icons/fontawesome6";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Attachment } from "@/types/presentation";
import CircularProgress from "./CircularProgress";

export const TILE_SIZE = 72;
/** Room above the tile for the remove badge, which overhangs its corner. */
export const TILE_TOP_PAD = 6;
/** Documents and links carry a name worth reading, so their tile is a pill. */
const PILL_WIDTH = 190;

const RED = "#FF3B30";

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AttachmentTileProps {
  item: Attachment;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /** Images only — documents have nothing to show full screen. */
  onOpen?: (item: Attachment, from: TileRect) => void;
}

/** The subset of FA6 names this tile draws. Typed so a rename is a compile
 *  error rather than a blank square. */
type DocIcon = "file-pdf" | "file-powerpoint" | "file-word" | "file-lines";

/** Icon and tint by file type. A PDF and a deck should not look identical at a
 *  glance, which is the entire job of a generic document preview.
 *
 *  Links never reach here — they have nothing to preview, so they stay as rows
 *  in the SwiftUI form. */
function documentLook(item: Attachment): {
  icon: DocIcon;
  tint: string;
  label: string;
} {
  const type = item.mimeType ?? "";
  const name = item.name.toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    return { icon: "file-pdf", tint: "#FF3B30", label: "PDF" };
  }
  if (type.includes("presentation") || name.endsWith(".pptx")) {
    return { icon: "file-powerpoint", tint: "#D24726", label: "Keynote" };
  }
  if (type.includes("word") || name.endsWith(".docx")) {
    return { icon: "file-word", tint: "#2B579A", label: "Document" };
  }
  return { icon: "file-lines", tint: "#8E8E93", label: "Text" };
}

const AttachmentTile = memo(
  ({ item, onRemove, onRetry, onOpen }: AttachmentTileProps) => {
    const ref = useRef<View>(null);
    const isImage = item.kind === "image" && !!item.uri;
    const uploading = item.status === "uploading";
    const failed = item.status === "failed";

    const handlePress = useCallback(() => {
      if (failed) {
        onRetry(item.id);
        return;
      }
      // Measured in window coordinates at the moment of the tap — the zoom
      // animates out of wherever the tile actually is, including mid-scroll.
      if (!isImage || !onOpen) return;
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpen(item, { x, y, width, height });
      });
    }, [failed, isImage, item, onOpen, onRetry]);

    const look = documentLook(item);

    return (
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={styles.wrapper}
      >
        <Pressable
          ref={ref}
          onPress={handlePress}
          style={[styles.tile, !isImage && styles.pill]}
        >
          {isImage ? (
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              // Blurring behind the loader is what makes the overlay read as
              // "this isn't ready yet" rather than as a dimmed thumbnail.
              blurRadius={uploading ? 12 : 0}
              transition={150}
            />
          ) : (
            <View style={styles.pillBody}>
              <Icon name={look.icon} iconStyle="solid" size={20} color={look.tint} />
              <View style={styles.pillText}>
                <Text numberOfLines={1} style={styles.pillName}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.pillType}>
                  {failed ? (item.error ?? "Upload failed") : look.label}
                </Text>
              </View>
            </View>
          )}

          {uploading && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(200)}
              style={[StyleSheet.absoluteFill, styles.uploadOverlay]}
            >
              <CircularProgress progress={item.progress} size={28} />
            </Animated.View>
          )}

          {failed && (
            <View style={[StyleSheet.absoluteFill, styles.failedOverlay]}>
              <Icon name="arrow-rotate-right" iconStyle="solid" size={18} color={RED} />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => onRemove(item.id)}
          hitSlop={8}
          style={styles.remove}
        >
          <Icon name="xmark" iconStyle="solid" size={10} color="#fff" />
        </Pressable>
      </Animated.View>
    );
  },
);

AttachmentTile.displayName = "AttachmentTile";

export default AttachmentTile;

const styles = StyleSheet.create({
  // Padded so the remove badge, which sits outside the tile, isn't clipped.
  wrapper: { paddingTop: TILE_TOP_PAD, paddingRight: 6 },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#EFEFF4",
  },
  pill: { width: PILL_WIDTH },
  pillBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  pillText: { flex: 1, gap: 2 },
  pillName: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  pillType: { fontSize: 12, color: "#8E8E93" },
  uploadOverlay: {
    alignItems: "center",
    justifyContent: "center",
    // Translucent rather than opaque so the picture stays recognisable
    // underneath — the user should still know which file this is.
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  failedOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.12)",
  },
  remove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,28,30,0.85)",
  },
});
