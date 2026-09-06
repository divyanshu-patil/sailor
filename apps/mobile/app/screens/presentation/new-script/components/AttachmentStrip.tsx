import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Attachment } from "@/types/presentation";
import AttachmentTile, {
  TILE_SIZE,
  TILE_TOP_PAD,
  type TileRect,
} from "./AttachmentTile";
import ImageZoomViewer from "./ImageZoomViewer";

const STRIP_HEIGHT = TILE_SIZE + TILE_TOP_PAD;

interface AttachmentStripProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * The attached files, as thumbnails.
 *
 * Rendered as React Native rather than inside the SwiftUI `Form`: a blurred
 * preview under a translucent overlay under a Skia ring is three layers SwiftUI
 * would need a nested host per tile to express, and the strip reads better
 * beside the composer than as a form section anyway.
 */
export default function AttachmentStrip({
  attachments,
  onRemove,
  onRetry,
}: AttachmentStripProps) {
  const [preview, setPreview] = useState<{
    uri: string;
    from: TileRect;
  } | null>(null);

  if (attachments.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      style={styles.container}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {attachments.map((item) => (
          <AttachmentTile
            key={item.id}
            item={item}
            onRemove={onRemove}
            onRetry={onRetry}
            onOpen={(opened, from) =>
              opened.uri && setPreview({ uri: opened.uri, from })
            }
          />
        ))}
        <View style={styles.tailSpacer} />
      </ScrollView>

      <ImageZoomViewer
        uri={preview?.uri ?? null}
        from={preview?.from ?? null}
        onClose={() => setPreview(null)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 4 },
  // Explicit height, and it is load-bearing. A horizontal ScrollView lays its
  // children out inside a separate content view, so Yoga has nothing to measure
  // for the ScrollView's own height — in a parent that doesn't constrain it,
  // that resolves to zero and the tiles render into a 0px-tall box. Sized off
  // TILE_SIZE so the two can't drift apart.
  scroller: { height: STRIP_HEIGHT },
  content: { paddingHorizontal: 20, gap: 10, alignItems: "flex-start" },
  // Keeps the last tile's remove badge clear of the screen edge.
  tailSpacer: { width: 6 },
});
