import { memo } from "react";

import SkiaMascot from "./skia-mascot";

import source from "@/assets/animations/watching.lottie";

/**
 * The new-script mascot, drawn by `SkiaMascot` from the .lottie's own state
 * machine: `watching` idles, and the boolean `isTyping` input switches it to
 * `observe` and back, playing the 300ms tween Blooby baked between the two
 * segments (backwards on the way back).
 *
 * `isTyping` is an address into the .lottie and must match the machine's
 * `inputs[].name`.
 */
const TYPING_INPUT = "isTyping";

interface MascotProps {
  /** Square side in points. */
  size: number;
  /** Off-screen copies hold their pose instead of burning frames. */
  playing?: boolean;
  /** Drives the file's `isTyping` input, so the machine picks the state. */
  observing?: boolean;
}

export default memo(function Mascot({
  size,
  playing = true,
  observing = false,
}: MascotProps) {
  return (
    <SkiaMascot
      source={source}
      width={size}
      inputs={{ [TYPING_INPUT]: observing }}
      paused={!playing}
      style={{ alignSelf: "center" }}
    />
  );
});
