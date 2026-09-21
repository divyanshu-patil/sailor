import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TMP = "/tmp/bake-icons";
mkdirSync(TMP, { recursive: true });

function rasterise(svgPath, target, width, height) {
  const svg = readFileSync(svgPath, "utf8");
  const page =
    `<!doctype html><html><body style="margin:0;padding:0;background:transparent">` +
    svg.replace(/width="[\d.]+"/, `width="${width}"`).replace(/height="[\d.]+"/, `height="${height}"`) +
    `</body></html>`;
  const pagePath = join(TMP, `${target.split("/").pop()}.html`);
  writeFileSync(pagePath, page);
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--default-background-color=00000000",
    `--screenshot=${target}`,
    `--window-size=${width},${height}`,
    "--force-device-scale-factor=1",
    `file://${pagePath}`,
  ], { stdio: "ignore" });
  console.log(`  ${target}  ${width}x${height}`);
}

// 3x the ~50pt the widget draws them at, so they stay crisp on every screen.
// Aspect ratios come from each source's own viewBox.
rasterise("assets/images/broken_heart.svg", "assets/widgets/widget-broken-heart.png", 180, 149);
rasterise("assets/images/hourglass.svg", "assets/widgets/widget-hourglass.png", 150, 180);
