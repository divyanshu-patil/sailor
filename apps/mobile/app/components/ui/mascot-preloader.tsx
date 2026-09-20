import LottieView from "lottie-react-native";
import { memo, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

import { LOGIN_MASCOT, MASCOTS } from "@/constants/mascots";

/**
 * Decodes every lottie-ios mascot once, off-screen, for as long as the auth
 * flow is mounted.
 *
 * `setSourceDotLottieURI` loads asynchronously and blanks the view until it
 * resolves, so a cold mascot costs a fetch-and-decode *and* an empty slot at
 * the worst possible moment — mid-push, on the screen you just opened.
 * lottie-ios keys `DotLottieCache.sharedCache` (an LRU of 100, cleared only on
 * a memory warning, not on backgrounding) by the animation's URL, so decoding
 * a source here leaves the parsed file in memory for every later mount.
 *
 * The base screen already displays the six coloured blobs, so in practice the
 * one this rescues is `LOGIN_MASCOT`; the rest cover entering the flow at a
 * deeper screen. They are listed together because it is one array either way.
 *
 * Not the cream mascots: those render through the dotLottie runtime, a
 * different cache this cannot reach.
 */
const PRELOAD_SOURCES = [...Object.values(MASCOTS), LOGIN_MASCOT];

export default memo(function MascotPreloader() {
  // Resolved the same way `animated-mascot` resolves it, so the cache key the
  // decode lands under is the one the real mount will look up.
  const sources = useMemo(
    () =>
      PRELOAD_SOURCES.map((source) => ({
        key: String(source),
        uri: Image.resolveAssetSource(source).uri,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.offscreen} aria-hidden>
      {sources.map(({ key, uri }) => (
        // `autoPlay={false}` is the point: the view exists to populate the
        // cache, not to animate. A stopped Lottie schedules no frame work, so
        // these cost their decode once and nothing per frame after that.
        <LottieView
          key={key}
          source={{ uri }}
          autoPlay={false}
          loop={false}
          style={styles.pixel}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    // Off the visible canvas as well as invisible: an opacity-0 view still
    // occupies its slot, and this one must never affect a screen's layout.
    left: -9999,
    top: -9999,
    overflow: "hidden",
  },
  pixel: {
    width: 1,
    height: 1,
  },
});
