/**
 * Bakes the mascot + confetti SVGs to PNG, at React Native's three densities.
 *
 *   node scripts/mascots/bake.mjs
 *
 * Rasterised with headless Chrome because it is already on every machine that
 * builds this app and it honours viewBox exactly. macOS QuickLook (`qlmanage`)
 * was the zero-dependency alternative and is not usable here: it letterboxes
 * the drawing and anchors it top-left, so the output is neither centred nor a
 * predictable size.
 *
 * The SVG source lives in shapes.mjs, in-repo, so these PNGs stay regenerable
 * rather than becoming binaries nobody can edit.
 *
 * Existing files are LEFT ALONE. The artwork here is placeholder — it is meant
 * to be replaced by hand, and a bake that silently overwrote a hand-drawn plate
 * with the generated one destroyed a morning's work once already. Pass --force
 * to regenerate everything, which is what you want after editing shapes.mjs.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  confetti,
  mascotCelebrate,
  mascotEmpty,
  mascotError,
  mascotNoResults,
  mascotSearch,
  mascotReading,
  widgetFlame,
  widgetMascots,
  widgetPlates,
} from "./shapes.mjs";

const FORCE = process.argv.includes("--force");
let skipped = 0;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../assets/mascots");
const WIDGET_OUT = resolve(HERE, "../../assets/widgets");
const TMP = resolve(HERE, ".tmp");

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((path) => {
  try { execFileSync("test", ["-x", path]); return true; } catch { return false; }
});

if (!CHROME) {
  console.error("No Chrome/Chromium found — needed to rasterise the SVGs.");
  process.exit(1);
}

/** Base (1x) sizes in points. @2x and @3x are derived. */
const ART = [
  { name: "mascot-reading",   svg: mascotReading(),   w: 180, h: 180 },
  { name: "mascot-celebrate", svg: mascotCelebrate(), w: 180, h: 180 },
  { name: "mascot-empty",     svg: mascotEmpty(),     w: 260, h: 210 },
  { name: "mascot-error",     svg: mascotError(),     w: 260, h: 210 },
  { name: "mascot-search",    svg: mascotSearch(),    w: 260, h: 210 },
  { name: "mascot-no-results", svg: mascotNoResults(), w: 260, h: 210 },
  { name: "confetti",         svg: confetti(),        w: 320, h: 220 },
];

mkdirSync(OUT, { recursive: true });
mkdirSync(WIDGET_OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

/**
 * Rasterise one SVG string to one PNG, via headless Chrome.
 *
 * Wrapped in HTML rather than screenshotting the .svg directly. Chrome renders
 * a bare SVG document at its intrinsic size inside the default 8px body margin,
 * which crops the art and offsets it; this pins the drawing to exactly the
 * window and removes the margin.
 */
function rasterise(svg, target, width, height) {
  if (!FORCE && existsSync(target)) {
    skipped++;
    return false;
  }

  const page = `<!doctype html><html><body style="margin:0;padding:0;background:transparent">` +
    svg
      .replace(/width="\d+"/, `width="${width}"`)
      .replace(/height="\d+"/, `height="${height}"`) +
    `</body></html>`;
  const pagePath = join(TMP, `${target.split("/").pop()}.html`);
  writeFileSync(pagePath, page);

  execFileSync(CHROME, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    // Transparent, not white — these sit on tinted cards.
    "--default-background-color=00000000",
    `--screenshot=${target}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=1`,
    `file://${pagePath}`,
  ], { stdio: "ignore" });
  return true;
}

/** The .svg beside each PNG is its editable source, and just as replaceable. */
function writeSource(target, svg) {
  if (!FORCE && existsSync(target)) return;
  writeFileSync(target, svg);
}

for (const art of ART) {
  // Keep the SVG next to the PNGs: it is the editable source of truth.
  writeSource(join(OUT, `${art.name}.svg`), art.svg);

  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? "" : `@${scale}x`;
    if (rasterise(art.svg, join(OUT, `${art.name}${suffix}.png`), art.w * scale, art.h * scale)) {
      console.log(`  ${art.name}${suffix}.png  ${art.w * scale}x${art.h * scale}`);
    }
  }
}

/**
 * Widget mascots — one file each, no @2x/@3x.
 *
 * The app copies these into the App Group and the widget draws them at a fixed
 * point frame, so SwiftUI scales one bitmap rather than picking a density
 * variant. Baked at the art's own 512x360 so there is headroom above @3x of the
 * largest slot any of the tiles gives it (~104x73pt).
 */
const WIDGET_ART = widgetMascots();
for (const art of WIDGET_ART) {
  writeSource(join(WIDGET_OUT, `${art.name}.svg`), art.svg);
  if (rasterise(art.svg, join(WIDGET_OUT, `${art.name}.png`), 512, 360)) {
    console.log(`  widgets/${art.name}.png  512x360`);
  }
}

/**
 * Background plates — one per variation per family, at @3x of the tile they
 * fill. The widget stretches these edge to edge, so they are baked at the
 * tile's own aspect: a single square plate stretched to systemMedium's 2.14:1
 * would smear every shape.
 */
const PLATES = widgetPlates();
for (const art of PLATES) {
  writeSource(join(WIDGET_OUT, `${art.name}.svg`), art.svg);
  const width = art.layout.w * 3;
  const height = art.layout.h * 3;
  if (rasterise(art.svg, join(WIDGET_OUT, `${art.name}.png`), width, height)) {
    console.log(`  widgets/${art.name}.png  ${width}x${height}`);
  }
}

/** The streak flame. Square, because the widget draws it in a 1:1 frame. */
writeSource(join(WIDGET_OUT, "widget-flame.svg"), widgetFlame());
if (rasterise(widgetFlame(), join(WIDGET_OUT, "widget-flame.png"), 150, 150)) {
  console.log("  widgets/widget-flame.png  150x150");
}

rmSync(TMP, { recursive: true, force: true });
console.log(
  skipped
    ? `\nSkipped ${skipped} file(s) that already exist — pass --force to regenerate them.`
    : "\nNothing left to bake.",
);
