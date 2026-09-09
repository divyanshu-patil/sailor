import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DotLottie, type Dotlottie } from "@lottiefiles/dotlottie-react-native";

import source from "@/assets/animations/watching.lottie";

/**
 * The mascot, played by the dotLottie runtime straight from the .lottie file.
 *
 * The file carries its own state machine: `watching` idles, and a boolean input
 * tweens it to `observe` and back over 300ms. The morph, its duration and its
 * curve are all declared in the file — nothing here interpolates anything, it
 * only sets the input.
 *
 * Both names below are addresses into the .lottie, and a wrong one fails in
 * silence: `stateMachineLoad` returns false, the native side discards that, and
 * a machine that never loaded raises no error. They must match the manifest's
 * `stateMachines[].id` and the machine's `inputs[].name`.
 */
const MACHINE_ID = "watching";
const TYPING_INPUT = "isTyping";

interface MascotProps {
  /** Square side in points. */
  size: number;
  /** Off-screen copies hold their pose instead of burning frames. */
  playing?: boolean;
  /** Drives the file's `isTyping` input, so the machine picks the state. */
  observing?: boolean;
  /** Reports every state the machine enters. Debug harnesses only. */
  onStateEntered?: (state: string) => void;
}

/** Forwarded so a debug screen can read the playhead back off the player. */
const Mascot = forwardRef<Dotlottie | null, MascotProps>(function Mascot(
  { size, playing = true, observing = false, onStateEntered },
  outerRef,
) {
  const ref = useRef<Dotlottie>(null);
  useImperativeHandle(outerRef, () => ref.current as Dotlottie, []);

  useEffect(() => {
    ref.current?.stateMachineSetBooleanInput(TYPING_INPUT, observing);
  }, [observing]);

  // Freeze, not pause: the state machine owns playback now, and it is the
  // thing that put the playhead inside a segment. `play()` restarts the whole
  // loaded animation, which threw the playhead back to frame 0 and let it run
  // the full 0-226 timeline — both poses, one after the other. Freezing only
  // stops the render loop, so the machine's segment survives it.
  useEffect(() => {
    if (playing) ref.current?.unfreeze();
    else ref.current?.freeze();
  }, [playing]);

  return (
    <DotLottie
      ref={ref}
      source={source}
      stateMachineId={MACHINE_ID}
      useFrameInterpolation
      style={{ width: size, height: size, alignSelf: "center" }}
      // Loaded here, not left to the `stateMachineId` prop: that setter runs
      // when the prop lands, which on first mount is before the view has built
      // its animation, so its load is a no-op on nil and is never retried.
      onLoad={() => {
        ref.current?.stateMachineLoad(MACHINE_ID);
        ref.current?.stateMachineStart();
        ref.current?.stateMachineSetBooleanInput(TYPING_INPUT, observing);
      }}
      // The only failure this reports is a machine already running; a machine
      // that never loaded says nothing at all, so treat silence as suspicious.
      onStateMachineError={(m) => console.warn("[mascot] state machine:", m)}
      onStateMachineStateEntered={(s) => {
        if (__DEV__) console.log("[mascot] entered", s);
        onStateEntered?.(s);
      }}
    />
  );
});

export default Mascot;
