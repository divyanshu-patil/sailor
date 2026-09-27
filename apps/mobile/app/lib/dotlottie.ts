import { Skia, type SkSkottieAnimation } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";

import type { Machine } from "./dotlottie-machine";

/**
 * A `.lottie` opened for Skia: the Skottie animation, its markers as frame
 * ranges, and its state machine (if it has one) for `dotlottie-machine`.
 */
export interface DotLottie {
  animation: SkSkottieAnimation;
  fps: number;
  /** Width and height of the Lottie canvas. */
  size: { width: number; height: number };
  /** The whole timeline, `[inPoint, outPoint]`. */
  full: [number, number];
  segments: Record<string, [number, number]>;
  machine: Machine | null;
}

/**
 * One load per file for the whole session. Promises are kept so concurrent
 * mounts share a load; `loaded` is the synchronous view of the finished ones,
 * so a remount (coming back to a tab) draws on its first frame.
 */
const loading = new Map<number, Promise<DotLottie>>();
const loaded = new Map<number, DotLottie>();

export const peekDotLottie = (source: number) => loaded.get(source);

export function loadDotLottie(source: number): Promise<DotLottie> {
  let pending = loading.get(source);
  if (!pending) {
    pending = open(source).then((lottie) => {
      loaded.set(source, lottie);
      return lottie;
    });
    // A failed load is dropped so the next mount retries it.
    pending.catch(() => loading.delete(source));
    loading.set(source, pending);
  }
  return pending;
}

/** Starts loading `sources` now, so the screens that show them don't wait. */
export function preloadDotLottie(sources: readonly number[]) {
  for (const source of sources)
    loadDotLottie(source).catch((e) =>
      console.warn("[dotlottie] preload failed", e),
    );
}

async function open(source: number): Promise<DotLottie> {
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  const zip = unzipSync(await new File(asset.localUri ?? asset.uri).bytes());
  const read = (path: string) => (zip[path] ? strFromU8(zip[path]) : null);

  const manifest = JSON.parse(read("manifest.json") ?? "{}");
  const animationId =
    manifest.initial?.animation ?? manifest.animations?.[0]?.id;
  const machineId =
    manifest.initial?.stateMachine ?? manifest.stateMachines?.[0]?.id;

  const json = read(`a/${animationId}.json`);
  if (!json) throw new Error(`no animation "${animationId}" in .lottie`);
  const machineJson = machineId ? read(`s/${machineId}.json`) : null;

  // Parsed for the markers and timing Skottie's handle does not expose.
  const lottie = JSON.parse(json);
  const segments: DotLottie["segments"] = {};
  for (const m of lottie.markers ?? []) segments[m.cm] = [m.tm, m.tm + m.dr];

  return {
    animation: Skia.Skottie.Make(json),
    fps: lottie.fr,
    size: { width: lottie.w, height: lottie.h },
    full: [lottie.ip, lottie.op],
    segments,
    machine: machineJson ? JSON.parse(machineJson) : null,
  };
}
