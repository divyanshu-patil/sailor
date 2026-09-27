import { Canvas, Group, Skottie } from "@shopify/react-native-skia";
import { useIsFocused } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import {
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { loadDotLottie, peekDotLottie, type DotLottie } from "@/lib/dotlottie";
import {
  settle,
  withDefaults,
  type Inputs,
  type MachineState,
} from "@/lib/dotlottie-machine";

/**
 * A `.lottie` mascot drawn by Skia (Skottie), driven by the file's own state
 * machine.
 *
 * Why Skia: the dotLottie player gives every view its own `MTKView` and draws
 * a `CGImage` on the main thread each frame (and can't be paused on iOS), and
 * lottie-ios can't run the state machine at all. Here each mascot is a Skia
 * canvas whose frame is advanced on the UI thread by Reanimated, and it stops
 * drawing entirely while its screen is out of focus — so a tab switch costs
 * nothing, and coming back draws from the already-parsed animation
 * (`lib/dotlottie` keeps every file loaded for the session).
 *
 * States: `inputs` go through `lib/dotlottie-machine`, which follows the file's
 * transitions. The first state is settled from the inputs directly, so a
 * mascot never flashes the file's default pose before the one asked for.
 * Every change of state is a cut, never animated — including the file's
 * `Tweened` transitions, whose durations are ignored on purpose.
 */
interface SkiaMascotProps {
  source: number;
  /** State-machine inputs, by name. Omitted ones keep the file's defaults. */
  inputs?: Inputs;
  /** Overrides the state's own `loop` (e.g. a one-shot cheer made to loop). */
  loop?: boolean;
  /** Scrubs the state's segment, 0 to 1, instead of playing it (a pull
   *  gesture). The clock never runs while this is set. */
  progress?: SharedValue<number>;
  /** Called once the animation is ready to draw. */
  onLoad?: () => void;
  /** Width in points. */
  width: number;
  /** Defaults to square. Pass it for a non-square canvas. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export default memo(function SkiaMascot(props: SkiaMascotProps) {
  const { source, width, height = props.width, style } = props;
  const [lottie, setLottie] = useState(() => peekDotLottie(source));

  useEffect(() => {
    if (lottie) return;
    let live = true;
    loadDotLottie(source).then(
      (l) => live && setLottie(l),
      (e) => console.warn("[skia-mascot] load failed", e),
    );
    return () => {
      live = false;
    };
  }, [source, lottie]);

  // Keyed on the load only: a parent's inline callback isn't a new load.
  useEffect(() => {
    if (lottie) props.onLoad?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lottie]);

  // Decorative everywhere, so it never takes a touch meant for what it overlaps.
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      {lottie ? <Player {...props} height={height} lottie={lottie} /> : null}
    </View>
  );
});

function segmentOf(lottie: DotLottie, state: MachineState | null) {
  return (state?.segment && lottie.segments[state.segment]) || lottie.full;
}

function Player({
  lottie,
  inputs,
  loop: loopOverride,
  progress,
  width,
  height,
}: SkiaMascotProps & { lottie: DotLottie; height: number }) {
  const { machine, animation, fps, size } = lottie;
  // Stable identity for the inputs, so a parent's new object literal on every
  // render is not a state change.
  const inputsKey = JSON.stringify(inputs ?? {});

  const first = useMemo(
    () =>
      machine
        ? settle(machine, machine.initial, withDefaults(machine, inputs)).state
        : null,
    // Only the first render's inputs; later ones go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machine],
  );
  const current = useRef(first);
  const [start0, end0] = segmentOf(lottie, first);
  const loops0 = loopOverride ?? first?.loop ?? true;

  // The playhead and its segment live on the UI thread.
  const start = useSharedValue(start0);
  const end = useSharedValue(end0);
  const loops = useSharedValue(loops0);
  const frame = useSharedValue(start0);

  useEffect(() => {
    if (!machine) return;
    const step = settle(
      machine,
      current.current?.name ?? machine.initial,
      withDefaults(machine, JSON.parse(inputsKey)),
    );
    if (step.state === current.current) return;
    current.current = step.state;
    const [s, e] = segmentOf(lottie, step.state);
    start.set(s);
    end.set(e);
    loops.set(loopOverride ?? step.state.loop ?? true);
    frame.set(s);
  }, [inputsKey, machine, lottie, loopOverride, frame, start, end, loops]);

  const tick = useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    const next = frame.get() + ((timeSincePreviousFrame ?? 0) / 1000) * fps;
    const span = end.get() - start.get();
    if (next < end.get()) frame.set(next);
    else if (loops.get() && span > 0)
      frame.set(start.get() + ((next - start.get()) % span));
    else frame.set(end.get() - 0.001);
  }, false);

  // Not drawing at all off-screen is the point: a tab in the background, or a
  // screen under a push, advances nothing and redraws nothing.
  const focused = useIsFocused();
  useEffect(() => {
    tick.setActive(focused && !progress);
  }, [focused, tick, progress]);

  useAnimatedReaction(
    () => progress?.get(),
    (p) => {
      if (p === undefined) return;
      const t = Math.min(1, Math.max(0, p));
      frame.set(start.get() + t * (end.get() - start.get() - 0.001));
    },
  );

  const scale = Math.min(width / size.width, height / size.height);
  const transform = useMemo(
    () => [
      { translateX: (width - size.width * scale) / 2 },
      { translateY: (height - size.height * scale) / 2 },
      { scale },
    ],
    [width, height, size, scale],
  );

  return (
    <Canvas style={{ width, height }}>
      <Group transform={transform}>
        <Skottie animation={animation} frame={frame} />
      </Group>
    </Canvas>
  );
}
