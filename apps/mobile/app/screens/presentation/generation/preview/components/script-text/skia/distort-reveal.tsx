import React, { useEffect, useMemo, useState } from "react";
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
 * so `resolution` and `center` are plain logical pixels.
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
  // Far enough that the front clears the whole block, plus the ring itself so
  // it starts fully off the leading edge and ends fully off the trailing one.
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

interface DistortRevealProps {
  width: number;
  height: number;
  /** Accent colour the wavefront pulls toward. */
  tint: string;
  /** Stagger, so consecutive blocks sweep one after another. */
  delayMs: number;
  children: React.ReactNode;
}

export const DistortReveal = ({
  width,
  height,
  tint,
  delayMs,
  children,
}: DistortRevealProps) => {
  const progress = useSharedValue(0);

  // If the shader failed to compile we're already "done" and children render
  // untouched — a bad shader should never cost the user their script.
  const [done, setDone] = useState(SOURCE === null);

  // Skia.Color gives back normalised 0..1 floats, which is what the shader's
  // `tint` uniform expects. Kept as three scalars so the worklet below closes
  // over plain numbers only.
  const { tintR, tintG, tintB } = useMemo(() => {
    const color = Skia.Color(tint);
    return { tintR: color[0], tintG: color[1], tintB: color[2] };
  }, [tint]);

  useEffect(() => {
    if (done) return;

    progress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: REVEAL.distortDurationMs,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Tear the layer down the moment the sweep is over. A runtime-shader layer
    // forces an offscreen render pass every frame it exists, and there is no
    // reason to keep paying that once the text is simply sitting there.
    const timeout = setTimeout(
      () => setDone(true),
      delayMs + REVEAL.distortDurationMs + REVEAL.distortTeardownMs,
    );

    return () => clearTimeout(timeout);
  }, [delayMs, done, progress]);

  const { ringWidth, amplitude, tintStrength } = REVEAL;

  const uniforms = useDerivedValue(
    () => ({
      resolution: [width, height],
      // Sweep out from the start of the block — where the eye already is.
      center: [width * 0.12, height * 0.15],
      progress: progress.value,
      ringWidth,
      amplitude,
      tint: [tintR, tintG, tintB],
      tintStrength,
    }),
    [
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

  if (done || !SOURCE) return <>{children}</>;

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
