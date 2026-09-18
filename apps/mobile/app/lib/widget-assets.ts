import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { Directory, File } from "expo-file-system";
import { widgetsDirectory } from "expo-widgets";

/**
 * Widget artwork, bridged into the App Group.
 *
 * A widget extension is a separate process with its own sandbox: it cannot read
 * the app's cache, and in a dev build a bundled asset only exists in that cache
 * (Metro serves it over HTTP). `widgetsDirectory` is the shared container both
 * processes can see, so the one thing that makes a PNG usable from a widget is
 * copying it there and passing the resulting path as a prop.
 *
 * SwiftUI is all a widget can render — no SVG component, no Lottie — which is
 * why the mascots are PNG at all. See scripts/mascots/shapes.mjs for the source
 * they are baked from.
 */

/** [REPLACE-LATER] — placeholder art, baked by scripts/mascots/bake.mjs. Swap
 *  the PNGs in assets/widgets/ and nothing here changes.
 *
 *  The background plates are per family because the tiles are 1:1 and 2.14:1 —
 *  one square plate stretched between them would smear every shape. */
const SOURCES = {
  "mascot-cream": require("../../assets/widgets/widget-mascot-cream.png"),
  "mascot-purple": require("../../assets/widgets/widget-mascot-purple.png"),
  "mascot-green": require("../../assets/widgets/widget-mascot-green.png"),
  "bg-cool-small": require("../../assets/widgets/widget-bg-cool-small.png"),
  "bg-cool-medium": require("../../assets/widgets/widget-bg-cool-medium.png"),
  "bg-streak-cool": require("../../assets/widgets/widget-bg-streak-cool.png"),
  flame: require("../../assets/widgets/widget-flame.png"),
};

export type WidgetArt = keyof typeof SOURCES;

/** Filled by `primeWidgetAssets`. Empty until then, and the widgets treat a
 *  missing path the same way they treat every other missing prop. */
const shared: Partial<Record<WidgetArt, string>> = {};

export function widgetArtUri(name: WidgetArt): string | undefined {
  return shared[name];
}

/**
 * Copy every piece of widget art into the shared container, once per launch.
 *
 * Unconditional rather than copy-if-missing: a handful of small PNGs is cheaper
 * than carrying a version stamp that has to be bumped by hand every time the
 * art is rebaked — and forgetting that bump would leave the old artwork on the
 * home screen with no way to tell from the code.
 */
export async function primeWidgetAssets(): Promise<void> {
  if (Platform.OS !== "ios" || !widgetsDirectory) return;

  const target = new Directory(widgetsDirectory);
  try {
    if (!target.exists) target.create({ intermediates: true });
  } catch (e) {
    console.log("widget asset directory unavailable", e);
    return;
  }

  await Promise.all(
    (Object.keys(SOURCES) as WidgetArt[]).map(async (name) => {
      try {
        const [asset] = await Asset.loadAsync(SOURCES[name]);
        if (!asset?.localUri) return;

        const destination = new File(target, `widget-${name}.png`);
        new File(asset.localUri).copySync(destination, { overwrite: true });
        shared[name] = destination.uri;
      } catch (e) {
        // One missing file is a plainer tile, not a broken app — every widget
        // prop is optional and the layouts fall back to a flat fill.
        console.log(`widget art ${name} unavailable`, e);
      }
    }),
  );
}
