/**
 * Proves the widget layouts survive being torn out of their module.
 *
 *   node scripts/check-widgets.mjs
 *
 * A `'widget'` function is not called in the app. Babel serialises its body to
 * a string (babel-preset-expo/plugins/widgets-plugin) and iOS re-evaluates that
 * string in a bare JS runtime whose only globals are @expo/ui's components and
 * modifiers. Two things go wrong there and neither shows up in tsc, lint or a
 * bundle:
 *
 *   1. A reference to anything at module scope — a constant, a helper, an
 *      imported type guard — is `undefined` at runtime, inside a runtime with
 *      nothing to catch it. The tile renders as a red "no layout" box.
 *   2. WidgetKit renders the layout with NO props at all (gallery preview,
 *      timeline placeholder, before the app's first push, App Group miss), so
 *      any prop read without a default prints the string "undefined" or throws.
 *
 * This checks both: the serialised source's free variables against the runtime's
 * real global set, and the function itself against every prop/environment
 * combination WidgetKit actually uses.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRequire } from "node:module";

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as babel from "@babel/core";

const traverse = _traverse.default ?? _traverse;
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const UI = resolve(ROOT, "../../node_modules/@expo/ui/build/swift-ui");

/* ---------------------------------------------------- the runtime's globals */

/**
 * Exactly what expo-widgets/bundle/index.ts assigns onto globalThis: every
 * export of @expo/ui/swift-ui and of its modifiers, plus the React/JSX stubs.
 * Read from the package rather than hand-listed, so a component renamed
 * upstream fails here instead of on someone's home screen.
 */
function widgetGlobals() {
  const names = new Set([
    "React", "createElement", "Children",
    // the two the decorator injects
    "__expoWidgetRender", "__expoWidgetHandlePress",
  ]);

  // The JSX names — `_jsx`, `_jsxs` and friends — are globals too, because
  // expo-widgets/bundle/index.ts spreads its jsx-runtime stub onto globalThis.
  // Read from that stub: babel picks between `jsx`, `jsxs` and `jsxDEV` (and
  // their underscore aliases) depending on the build, and a whitelist typed by
  // hand would go stale the first time that choice changed.
  const stub = readFileSync(
    resolve(ROOT, "../../node_modules/expo-widgets/bundle/jsx-runtime-stub.ts"),
    "utf8",
  );
  const exportBlock = stub.slice(stub.lastIndexOf("export {"));
  for (const [, name] of exportBlock.matchAll(/(?:as\s+)?(\w+)\s*,/g)) names.add(name);

  // Components: one directory per export, plus the extra named exports that a
  // few of those directories declare (Shapes is six in one file).
  for (const entry of readdirSync(UI, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "modifiers") continue;
    names.add(entry.name);
    const dts = resolve(UI, entry.name, "index.d.ts");
    try {
      for (const [, name] of readFileSync(dts, "utf8").matchAll(
        /export declare (?:function|const) (\w+)/g,
      )) {
        names.add(name);
      }
    } catch {
      /* a directory without an index.d.ts exports only its own name */
    }
  }

  const modifiers = readFileSync(resolve(UI, "modifiers/index.d.ts"), "utf8");
  for (const [, name] of modifiers.matchAll(/export declare (?:const|function) (\w+)/g)) {
    names.add(name);
  }
  // Re-exported rather than declared in that file.
  for (const name of ["shapes", "background", "containerBackground", "containerShape",
    "contentShape", "animation", "environment", "symbolEffect", "widgetURL",
    "activityBackgroundTint", "widgetAccentedRenderingMode", "datePickerStyle",
    "gaugeStyle", "progressViewStyle", "pickerStyle", "menuOrder", "tag", "id",
    "scrollPosition", "onScrollPhaseChange", "useScrollGeometryChange"]) {
    names.add(name);
  }
  return names;
}

/** Everything a plain JS runtime has regardless. */
const JS_GLOBALS = new Set([
  "Array", "Object", "String", "Number", "Boolean", "Math", "JSON", "Date",
  "RegExp", "Map", "Set", "Error", "Infinity", "NaN", "undefined", "isFinite",
  "isNaN", "parseInt", "parseFloat", "console", "globalThis", "Promise", "Symbol",
]);

/* ------------------------------------------ 1. free variables in the source */

/** Run the real plugin chain and hand back each serialised widget body. */
function serialisedWidgets(file) {
  const out = babel.transformSync(readFileSync(file, "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }]],
    plugins: [
      [require.resolve("@babel/plugin-transform-react-jsx"), { runtime: "automatic" }],
      // Named export, not default — hand babel the function itself.
      require("babel-preset-expo/build/plugins/widgets-plugin.js").widgetsPlugin,
    ],
  });

  const bodies = [];
  traverse(parse(out.code, { sourceType: "module" }), {
    TemplateLiteral(path) {
      const raw = path.node.quasis[0]?.value.cooked ?? "";
      if (raw.startsWith("function(")) bodies.push(raw);
    },
  });
  return bodies;
}

function freeVariables(source) {
  const ast = parse(`(${source})`, { sourceType: "script" });
  const free = new Set();
  traverse(ast, {
    ReferencedIdentifier(path) {
      if (!path.scope.hasBinding(path.node.name, { noGlobals: true })) {
        free.add(path.node.name);
      }
    },
  });
  return free;
}

/* --------------------------------------------- 2. the layout, actually run */

/**
 * Evaluate the serialised body the way iOS does — as a standalone function with
 * the runtime's globals as its only scope — and call it. Components become
 * plain tree nodes; nothing here cares what SwiftUI would do with them, only
 * that building the tree neither throws nor leaves "undefined" in it.
 */
function evaluateLayout(source, globals) {
  const names = [...globals];
  const stub = (type) => (props) => ({ type, props });
  const jsx = (type, props) => ({
    type: typeof type === "string" ? type : (type.__name ?? "component"),
    props,
  });
  // The one global that is a namespace rather than a function.
  const shapes = Object.fromEntries(
    ["roundedRectangle", "capsule", "rectangle", "ellipse", "circle", "containerRelativeShape"]
      .map((shape) => [shape, (params) => ({ shape, ...params })]),
  );

  const values = names.map((name) => {
    if (/^_?jsx(s|DEV)?$/.test(name)) return jsx;
    if (name === "Fragment" || name === "_Fragment") return "Fragment";
    if (name === "shapes") return shapes;
    // Carries `.Content`, which the layouts use for the decorative layer.
    if (name === "Background") {
      const B = stub("Background");
      B.Content = stub("Background.Content");
      B.__name = "Background";
      return B;
    }
    if (name === "React") return { createElement: jsx, Children: { toArray: (x) => [].concat(x ?? []) } };
    // Doubles as a component factory and a modifier: a component call returns
    // a node, and a modifier call's result is only ever read back by name.
    const fn = (...args) => ({ type: name, props: args[0], __mod: name, args });
    fn.__name = name;
    return fn;
  });
  // eslint-disable-next-line no-new-func
  return new Function(...names, `return (${source});`)(...values);
}

/** Every node in the rendered tree, depth first. */
function nodesIn(node, found = []) {
  if (node == null || typeof node !== "object") return found;
  if (Array.isArray(node)) { for (const child of node) nodesIn(child, found); return found; }
  if (node.type) found.push(node);
  nodesIn(node.props?.children, found);
  return found;
}

/**
 * Nothing in the tree may declare a frame larger than the tile it is drawn in.
 *
 * This is the check that was missing. A SwiftUI stack takes the size of its
 * largest child, so a decorative blob given a 230pt width inside a 158pt tile
 * made the whole stack 230pt wide — the text column was laid out against that,
 * WidgetKit cropped the result back to 158, and every line lost its first few
 * characters. It rendered, it type-checked, and it was wrong on the device.
 */
const TILE = { systemSmall: { w: 158, h: 158 }, systemMedium: { w: 338, h: 158 } };

function oversizedFrames(tree, family) {
  const tile = TILE[family];
  if (!tile) return [];
  const bad = [];
  for (const node of nodesIn(tree)) {
    for (const modifier of node.props?.modifiers ?? []) {
      const f = modifier?.args?.[0];
      if (!f || typeof f !== "object" || modifier.__mod !== "frame") continue;
      if (typeof f.width === "number" && f.width > tile.w) bad.push(`${node.type} width ${f.width} > ${tile.w}`);
      if (typeof f.height === "number" && f.height > tile.h) bad.push(`${node.type} height ${f.height} > ${tile.h}`);
    }
  }
  return bad;
}

/** Every string anywhere in the rendered tree. */
function textIn(node, found = []) {
  if (node == null) return found;
  if (typeof node === "string") { found.push(node); return found; }
  if (Array.isArray(node)) { for (const child of node) textIn(child, found); return found; }
  if (typeof node === "object") { for (const value of Object.values(node)) textIn(value, found); }
  return found;
}

/* --------------------------------------------------------------- the check */

const WIDGETS = [
  { file: resolve(ROOT, "app/widgets/TodaysPracticeWidget.tsx"), name: "TodaysPracticeWidget" },
  { file: resolve(ROOT, "app/widgets/StreakWidget.tsx"), name: "StreakWidget" },
];

/** Everything WidgetKit puts a layout through, including the empty cases. */
const PROP_CASES = [
  ["no props at all (gallery preview / placeholder)", {}],
  ["null-ish props", { variation: null, situationLabel: null, oneLiner: null,
    oneLinerShort: null, tip: null, dateLabel: null, note: null, plateUri: null,
    plateSmallUri: null, mascotUri: null, mascotSmallUri: null, streakCount: null,
    accentColor: null, label: null }],
  ["wrong types", { variation: 7, situationLabel: 3, oneLiner: {}, oneLinerShort: 0,
    tip: [], dateLabel: true, note: 0, plateUri: 5, plateSmallUri: {}, mascotUri: 12,
    mascotSmallUri: {}, streakCount: "nine", accentColor: "#ff0", label: [] }],
  ["warm, full", { variation: "warm", situationLabel: "Product Demo",
    oneLiner: "Once, I completely failed at something, and it turned out well.",
    oneLinerShort: "Once, I completely failed at\u2026",
    tip: "Keep it personal and specific.", dateLabel: "Thu, Sep 18",
    note: "Keep going!", plateUri: "file:///g/widget-bg-warm-medium.png",
    plateSmallUri: "file:///g/widget-bg-warm-small.png",
    mascotUri: "file:///g/widget-mascot-pink.png",
    mascotSmallUri: "file:///g/widget-mascot-cream.png", streakCount: 12,
    accentColor: "#F4D35E", label: "day streak" }],
  ["cool, full", { variation: "cool", situationLabel: "Explaining Tech",
    oneLiner: "It's normal to feel nervous before speaking.",
    oneLinerShort: "It's normal to feel nervous\u2026",
    tip: "Breathe slowly and focus on your message.", dateLabel: "Thu, Sep 18",
    note: "Same you, brighter ideas.", plateUri: "file:///g/widget-bg-cool-medium.png",
    plateSmallUri: "file:///g/widget-bg-cool-small.png",
    mascotUri: "file:///g/widget-mascot-cream.png",
    mascotSmallUri: "file:///g/widget-mascot-purple.png", streakCount: 0,
    accentColor: "#A0A3FF", label: "day streak" }],
];

const ENVIRONMENTS = [
  ["small / light", { widgetFamily: "systemSmall", colorScheme: "light" }],
  ["small / dark", { widgetFamily: "systemSmall", colorScheme: "dark" }],
  ["medium / light", { widgetFamily: "systemMedium", colorScheme: "light" }],
  ["medium / dark", { widgetFamily: "systemMedium", colorScheme: "dark" }],
  ["empty environment", {}],
];

const globals = widgetGlobals();
let checks = 0;

for (const widget of WIDGETS) {
  const bodies = serialisedWidgets(widget.file);
  assert.equal(bodies.length, 1, `${widget.name}: expected exactly one 'widget' function, got ${bodies.length}`);
  const [body] = bodies;

  const free = freeVariables(body);
  const escaped = [...free].filter((name) => !globals.has(name) && !JS_GLOBALS.has(name));
  assert.deepEqual(escaped, [],
    `${widget.name}: references ${escaped.join(", ")} — not available in the widget runtime, ` +
    `so it would be undefined on device. Move it inside the function body.`);
  checks++;

  for (const [propLabel, props] of PROP_CASES) {
    for (const [envLabel, environment] of ENVIRONMENTS) {
      const where = `${widget.name} — ${propLabel} @ ${envLabel}`;
      let tree;
      assert.doesNotThrow(() => { tree = evaluateLayout(body, globals)(props, environment); }, where);

      const strings = textIn(tree);
      assert.ok(!strings.some((s) => s.includes("undefined")),
        `${where}: rendered the literal string "undefined"`);
      assert.ok(!strings.some((s) => s.includes("NaN")),
        `${where}: rendered the literal string "NaN"`);
      // A tile that draws nothing is the failure this whole file exists for.
      assert.ok(strings.some((s) => s.trim().length > 0), `${where}: rendered no text at all`);

      const oversized = oversizedFrames(tree, environment.widgetFamily);
      assert.deepEqual(oversized, [],
        `${where}: ${oversized.join("; ")} — a stack takes the size of its largest ` +
        `child, so this would push the text column off the tile.`);
      checks++;
    }
  }
}

/* Every piece of art the sync can name must actually be baked, and every baked
   file must be reachable from it — an orphan is art nobody will ever see. */
const baked = new Set(
  readdirSync(resolve(ROOT, "assets/widgets")).filter((f) => f.endsWith(".png")),
);
const sync = readFileSync(resolve(ROOT, "app/lib/widget-sync.ts"), "utf8");
const named = [...sync.matchAll(/: "((?:mascot|bg)-[\w-]+)"/g)].map(([, n]) => n);
assert.ok(named.length >= 12,
  `expected both variations' plates and characters in widget-sync, found ${named.length}`);
for (const name of named) {
  assert.ok(baked.has(`widget-${name}.png`),
    `widget-sync names "${name}" but assets/widgets/widget-${name}.png is not baked`);
  checks++;
}
for (const file of baked) {
  assert.ok(named.includes(file.replace(/^widget-|\.png$/g, "")),
    `assets/widgets/${file} is baked but nothing in widget-sync names it`);
  checks++;
}

console.log(`ALL CHECKS PASSED (${checks})`);
