import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useIsFocused } from "expo-router";
import { Group, Paint, RuntimeShader, Skia } from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { REVEAL } from "../config";

/**
 * A circular wavefront sweeps out from `center`. Everything it has passed is
 * visible; right at the front the glyphs are pushed radially outward, split
 * per colour channel, and pulled toward the accent tint — so the text arrives
 * through a ring of chromatic distortion rather than just appearing.
 *
 * Runs as a runtime-shader image filter, which Skia evaluates in the layer's
 * *local* coordinate space — the same units as the <Text x y> values below it,
 * so `center` is in plain logical pixels. `resolution` is the area the whole
 * sweep covers rather than this block's own size: the ring belongs to the
 * screen, and each block only ever sees the slice of it that crosses its canvas.
 */
const SOURCE = Skia.RuntimeEffect.Make(`
uniform shader image;

uniform float2 resolution;
uniform float2 center;
uniform float  progress;    // 0 -> 1, drives the wavefront outward
uniform float  ringWidth;   // px, thickness of the distorted band
uniform float  amplitude;   // px, peak displacement at the front
uniform float3 tint;        // accent colour, linear 0..1
uniform float  tintStrength;

half4 main(float2 xy) {
  // Far enough that the front clears the whole swept area, plus the ring itself
  // so it starts fully off the leading edge and ends fully off the trailing one.
  float span   = length(resolution) + ringWidth;
  float radius = progress * span - ringWidth * 0.5;

  float d = distance(xy, center);

  // 1 on the wavefront, falling to 0 either side of it.
  float band = 1.0 - smoothstep(0.0, ringWidth, abs(d - radius));

  // Inside the front is drawn, outside is not; the edge is softened over a
  // quarter of the ring so glyphs don't pop in.
  float reveal = 1.0 - smoothstep(
    radius - ringWidth * 0.25,
    radius + ringWidth * 0.25,
    d
  );

  float2 dir = d > 0.001 ? (xy - center) / d : float2(0.0, 1.0);
  float2 offset = dir * band * amplitude;

  // Per-channel offsets — the chromatic part of the distortion. Away from the
  // front the offset is zero, so all three samples collapse to the same pixel
  // and the text is left exactly as drawn.
  half4 sr = image.eval(xy + offset);
  half4 sg = image.eval(xy + offset * 0.35);
  half4 sb = image.eval(xy - offset * 0.6);

  half  alpha = max(sr.a, max(sg.a, sb.a));
  half3 rgb   = half3(sr.r, sg.g, sb.b);

  // Colour distortion: bias the band toward the accent. Alpha-weighted
  // because everything here is premultiplied.
  rgb = mix(rgb, half3(tint) * alpha, half(band * tintStrength));

  return half4(rgb, alpha) * half(reveal);
}
`);

interface SweepValue {
  /** Flips true when the reveal should begin — the blocks are measured and the
   *  screen is focused. Each block starts its own sweep off this. */
  started: boolean;
  /** True once the cascade is over and the shader layers can go. */
  done: boolean;
  tint: string;
}

const SweepContext = createContext<SweepValue | null>(null);

interface DistortSweepProps {
  /** Held false until the body has been measured — the sweep can't start
   *  before it knows the area it has to cross. */
  ready: boolean;
  /**
   * Identity of the text being revealed. A script that arrives late, or gets
   * replaced by a revision, mounts a fresh body that deserves its own sweep —
   * without this it would inherit a wavefront that has already run and simply
   * appear. Each block used to own its sweep and got this for free; one shared
   * wavefront has to be told.
   */
  content: unknown;
  /** Longest per-block delay in the cascade, so the teardown waits for the
   *  last block rather than the first. */
  lastDelayMs: number;
  /** Accent colour the wavefront pulls toward. */
  tint: string;
  children: React.ReactNode;
}

/**
 * Starts and ends the reveal for every block on the first screen.
 *
 * It does not own the wavefront — each block sweeps its own canvas, because
 * that is the only geometry the shader is known to draw correctly. What this
 * owns is the single moment they all key off, so the cascade begins once, when
 * the screen is focused and the blocks have been measured.
 */
export const DistortSweep = ({
  ready,
  content,
  lastDelayMs,
  tint,
  children,
}: DistortSweepProps) => {
  // If the shader failed to compile we're already "done" and children render
  // untouched — a bad shader should never cost the user their script.
  const [done, setDone] = useState(SOURCE === null);

  // New text, new sweep. Adjusted during render rather than in an effect so
  // there's no commit where the replacement body is up with the previous
  // sweep's state.
  const [prevContent, setPrevContent] = useState(content);
  if (content !== prevContent) {
    setPrevContent(content);
    setDone(SOURCE === null);
  }

  /**
   * Focus, not mount.
   *
   * The two are the same moment on the preview screen, but not on the script
   * screen: its text can be up before the push has settled, and it can also be
   * mounted behind another screen — a script that lands while the user is
   * elsewhere would have spent its reveal off-screen. Tying the sweep to focus
   * means it plays when there is someone to watch it.
   *
   * Blurring also makes an interrupted sweep replay: navigate away
   * mid-wavefront and `done` was never set, so coming back starts it over
   * rather than leaving the text half-revealed. Once it has finished, `done`
   * keeps it finished — returning to a script you have already seen shouldn't
   * re-animate the paragraph you were reading.
   *
   * `useIsFocused` rather than `useFocusEffect` only because the sweep starts
   * by writing a shared value, which belongs in an effect body; the focus
   * gating is the same.
   */
  const isFocused = useIsFocused();

  // Derived, not state: every input is already known during render, and the
  // blocks read it straight out of the context. Blurring flips it back off on
  // its own, which is what lets an interrupted reveal restart on return.
  const started = !done && ready && isFocused;

  // TEMPORARY DIAGNOSTIC — delete once the script screen's reveal is confirmed.
  useEffect(() => {
    if (!__DEV__) return;
    console.log("[distort-sweep]", { ready, isFocused, done, started });
  }, [ready, isFocused, done, started]);

  useEffect(() => {
    if (!started) return;

    // Tear the layers down once the last block in the cascade has finished. A
    // runtime-shader layer forces an offscreen render pass every frame it
    // exists, and there is no reason to keep paying that — on every block at
    // once — while the text is simply sitting there.
    const timeout = setTimeout(
      () => setDone(true),
      REVEAL.startDelayMs +
        lastDelayMs +
        REVEAL.distortDurationMs +
        REVEAL.distortTeardownMs,
    );

    return () => clearTimeout(timeout);
  }, [started, lastDelayMs]);

  const value = useMemo<SweepValue>(
    () => ({ started, done, tint }),
    [started, done, tint],
  );

  return (
    <SweepContext.Provider value={value}>{children}</SweepContext.Provider>
  );
};

DistortSweep.displayName = "DistortSweep";

interface DistortRevealProps {
  /** This block's own canvas. The wavefront is expressed entirely inside it —
   *  `resolution` and `center` never refer to anything off this canvas. */
  width: number;
  height: number;
  /** Position in the cascade, derived from how far down the page this block
   *  sits, so the reveal travels down the screen. */
  delayMs: number;
  children: React.ReactNode;
}

export const DistortReveal = ({
  width,
  height,
  delayMs,
  children,
}: DistortRevealProps) => {
  const sweep = useContext(SweepContext);
  const started = sweep?.started ?? false;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!started) return;

    progress.value = 0;
    progress.value = withDelay(
      REVEAL.startDelayMs + delayMs,
      withTiming(1, {
        duration: REVEAL.distortDurationMs,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [started, delayMs, progress]);

  // Skia.Color gives back normalised 0..1 floats, which is what the shader's
  // `tint` uniform expects. Kept as three scalars so the worklet below closes
  // over plain numbers only.
  const { tintR, tintG, tintB } = useMemo(() => {
    const color = Skia.Color(sweep?.tint ?? "#000");
    return { tintR: color[0], tintG: color[1], tintB: color[2] };
  }, [sweep?.tint]);

  const { ringWidth, amplitude, tintStrength } = REVEAL;

  const uniforms = useDerivedValue(
    () => ({
      resolution: [width, height],
      // Sweep out from the start of the block — where the eye already is.
      center: [width * REVEAL.sweepOriginX, height * REVEAL.sweepOriginY],
      progress: progress.value,
      ringWidth,
      amplitude,
      tint: [tintR, tintG, tintB],
      tintStrength,
    }),
    [
      progress,
      width,
      height,
      tintR,
      tintG,
      tintB,
      ringWidth,
      amplitude,
      tintStrength,
    ],
  );

  if (!sweep || sweep.done || !SOURCE) return <>{children}</>;

  return (
    <Group
      layer={
        <Paint>
          <RuntimeShader source={SOURCE} uniforms={uniforms} />
        </Paint>
      }
    >
      {children}
    </Group>
  );
};

DistortReveal.displayName = "DistortReveal";
