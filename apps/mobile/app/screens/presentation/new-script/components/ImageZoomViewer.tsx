/* eslint-disable react-hooks/immutability */
import { useEffect } from "react";
import { Dimensions, Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TileRect } from "./AttachmentTile";

interface ImageZoomViewerProps {
  uri: string | null;
  /** Where on screen the thumbnail was when it was tapped. The image grows out
   *  of this rect and shrinks back into it. */
  from: TileRect | null;
  onClose: () => void;
}

// iOS's own presentation feel: firm, barely any overshoot.
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;

/**
 * Full-screen image, zoomed out of its thumbnail.
 *
 * Hand-rolled rather than a navigation transition: react-native-screens 4.25
 * exposes no iOS 18 zoom animation, and its `StackAnimationTypes` has nothing
 * closer than `fade`. Interpolating the tile's measured rect to a full-screen
 * one gets the same effect without a navigation route for a preview.
 */
export default function ImageZoomViewer({
  uri,
  from,
  onClose,
}: ImageZoomViewerProps) {
  const progress = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const visible = uri != null && from != null;

  useEffect(() => {
    progress.value = visible ? withSpring(1, SPRING) : 0;
  }, [visible, progress]);

  const close = () => {
    // Unmount only once the image is back in the thumbnail, otherwise it
    // vanishes mid-flight and the zoom reads as a flicker.
    progress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  // Target: full width, centred, leaving the safe areas clear.
  const targetWidth = screenWidth;
  const targetHeight = screenHeight - insets.top - insets.bottom;
  const targetX = 0;
  const targetY = insets.top;

  const imageStyle = useAnimatedStyle(() => {
    if (!from) return { opacity: 0 };
    return {
      left: interpolate(progress.value, [0, 1], [from.x, targetX]),
      top: interpolate(progress.value, [0, 1], [from.y, targetY]),
      width: interpolate(progress.value, [0, 1], [from.width, targetWidth]),
      height: interpolate(progress.value, [0, 1], [from.height, targetHeight]),
      // Corner radius relaxes as it grows, the way a Photos thumbnail does.
      borderRadius: interpolate(progress.value, [0, 1], [16, 0]),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      // The zoom *is* the transition; letting Modal add its own would play two.
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View style={[styles.image, imageStyle]}>
          {uri && (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              // `contain` full screen, but the thumbnail it grows from was
              // `cover`. Contain is the correct end state — a cropped
              // full-screen preview would hide part of what the user attached.
              contentFit="contain"
            />
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "#000" },
  image: { position: "absolute", overflow: "hidden" },
});
