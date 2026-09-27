import LottieView from "lottie-react-native";
import { memo, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

/**
 * Decodes a set of lottie-ios mascots once, off-screen, for as long as the
 * navigator it is mounted in lives.
 *
 * `setSourceDotLottieURI` loads asynchronously and blanks the view until it
 * resolves, so a cold mascot costs a fetch-and-decode *and* an empty slot at
 * the worst possible moment — mid-push, on the screen you just opened.
 * lottie-ios keys `DotLottieCache.sharedCache` (an LRU of 100, cleared only on
 * a memory warning, not on backgrounding) by the animation's URL, so decoding
 * a source here leaves the parsed file in memory for every later mount.
 *
 * Used by the auth flow (the coloured blobs around forgot-password's hero).
 * The signed-in app's mascots play through Skia instead, and `lib/dotlottie`
 * keeps those loaded.
 *
 * Not the state-machine mascots (the auth cast, the cream ones): those render
 * through the dotLottie runtime, a different cache this cannot reach.
 */
export default memo(function MascotPreloader({
  sources: modules,
}: {
  /** Asset modules. Pass a module-level array so the memo below holds. */
  sources: readonly number[];
}) {
  // Resolved the same way `animated-mascot` resolves it, so the cache key the
  // decode lands under is the one the real mount will look up.
  const sources = useMemo(
    () =>
      modules.map((source) => ({
        key: String(source),
        uri: Image.resolveAssetSource(source).uri,
      })),
    [modules],
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
