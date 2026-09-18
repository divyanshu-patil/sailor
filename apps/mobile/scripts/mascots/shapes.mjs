/**
 * Mascot + confetti artwork, as SVG source.
 *
 * Deliberately primitive: a deformed circle, two eyes, two yellow strips. No
 * gradients-as-3D, no limbs, no shading stack. The reference art is rendered
 * illustration; this is the flat, honest version of it that one person can edit
 * by hand and that rasterises identically everywhere.
 *
 * Colours come from the app's existing deck palette (constants/deck-palette.ts)
 * rather than a new mascot palette, so the characters belong to the same world
 * as the decks and the widgets.
 */

export const PALETTE = {
  periwinkle: "#A0A3FF",
  coral: "#F78199",
  mustard: "#F4D35E",
  apricot: "#FFC88A",
  orchid: "#EFC1FF",
  sage: "#ACCCC0",
  dustyBlue: "#A1AFDE",
  ink: "#2A2440",
};

/**
 * The body. A circle pulled off-centre so it reads as hand-drawn — the control
 * points are intentionally asymmetric, which is the whole difference between
 * "blob character" and "circle".
 */
const BLOB =
  "M 250 48 C 372 44 456 136 454 254 C 452 366 374 462 252 462 " +
  "C 130 462 58 372 58 250 C 58 128 134 52 250 48 Z";

/** The two yellow strips, sitting on the upper-right shoulder of the blob. */
function strips(color = PALETTE.mustard) {
  return `
  <g transform="translate(372 96) rotate(28)">
    <rect x="0" y="0" width="16" height="54" rx="8" fill="${color}"/>
    <rect x="30" y="18" width="16" height="40" rx="8" fill="${color}"/>
  </g>`;
}

/** Open, attentive eyes — the reading pose. */
function eyesOpen() {
  return `
  <ellipse cx="196" cy="272" rx="23" ry="31" fill="${PALETTE.ink}"/>
  <ellipse cx="318" cy="272" rx="23" ry="31" fill="${PALETTE.ink}"/>`;
}

/**
 * Closed, upturned eyes — the celebrating pose.
 *
 * Wide and shallow on purpose. The first pass used a 38px rise over a 52px
 * span and the two arcs read as angry eyebrows rather than happy eyes: with no
 * other features on the face, a steep arch is the only signal available and the
 * eye reads as a frown. Flattening the curve (24 over 68) and widening the gap
 * turns it back into a squint.
 */
function eyesHappy() {
  return `
  <path d="M 162 280 Q 196 254 230 280" fill="none" stroke="${PALETTE.ink}"
        stroke-width="16" stroke-linecap="round"/>
  <path d="M 284 280 Q 318 254 352 280" fill="none" stroke="${PALETTE.ink}"
        stroke-width="16" stroke-linecap="round"/>`;
}

function mascot({ fill, eyes }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <path d="${BLOB}" fill="${fill}"/>
${eyes}
${strips()}
</svg>`;
}

export const mascotReading = () =>
  mascot({ fill: PALETTE.periwinkle, eyes: eyesOpen() });

export const mascotCelebrate = () =>
  mascot({ fill: PALETTE.coral, eyes: eyesHappy() });

/**
 * Confetti, scattered with a seeded PRNG.
 *
 * Seeded so the art is reproducible: re-running the bake must produce the same
 * PNG, or every asset rebuild becomes a diff nobody can review.
 */
export function confetti() {
  let seed = 20260918;
  const rand = () => {
    // Mulberry32 — small, deterministic, good enough for scattering rectangles.
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const colors = [
    PALETTE.coral, PALETTE.mustard, PALETTE.sage,
    PALETTE.orchid, PALETTE.periwinkle, PALETTE.apricot,
  ];

  const W = 640;
  const H = 440;
  const pieces = [];

  // Over-sampled: candidates that would land on the mascot are discarded, so
  // the loop runs well past the number of pieces actually wanted.
  for (let i = 0; i < 70; i++) {
    const x = 16 + rand() * (W - 48);
    const y = 12 + rand() * (H - 40);
    const cx = W / 2;
    const cy = H / 2;
    // Keep a clear well in the middle for the mascot this is thrown around.
    // Everything outside it is fair game, including down the sides — an
    // earlier version biased hard toward the top and left the bottom third
    // visibly empty.
    const clearsCentre = Math.abs(x - cx) > 132 || Math.abs(y - cy) > 108;
    if (!clearsCentre) continue;
    if (pieces.length >= 32) break;

    const w = 10 + rand() * 6;
    const h = 22 + rand() * 16;
    const rot = rand() * 360;
    const color = colors[Math.floor(rand() * colors.length)];
    pieces.push(
      `  <rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" ` +
      `height="${h.toFixed(1)}" rx="${(w / 2).toFixed(1)}" fill="${color}" ` +
      `transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${pieces.join("\n")}
</svg>`;
}

/* ------------------------------------------------------------------ widgets */

/**
 * Widget mascots.
 *
 * [REPLACE-LATER] — placeholder art. These are baked to PNG because a widget
 * extension renders SwiftUI only: no SVG, no Lottie, no vector component. Drop
 * a replacement PNG of the same name into assets/widgets/ and nothing else has
 * to change.
 *
 * Shaped as a dome rather than a full blob: in the reference the character is
 * cropped by the tile's bottom edge, peeking in. Drawing it pre-cropped is what
 * lets the widget place it flush against an edge-to-edge background instead of
 * leaving a transparent gutter under a circle.
 */
export const WIDGET_PALETTE = {
  cream: "#FFF4E8",
  pink: "#FF8FB2",
  blue: "#5C9CF5",
  purple: "#B49BF2",
  green: "#63D2A4",
  strip: "#FFC94D",
  stripCool: "#9FB6FF",
  ink: "#2B2A33",
};

const W_W = 512;
const W_H = 360;

/** A hill. Asymmetric control points, same reason as BLOB — a symmetric arc
 *  reads as a semicircle, not a character. */
const DOME =
  `M 8 ${W_H} C 2 206 96 44 258 44 C 418 44 510 206 504 ${W_H} Z`;

/** The two ticks, mirrored to whichever side has room. */
function widgetStrips(color, { x, y, rotate }) {
  return `
  <g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="0" y="0" width="22" height="72" rx="11" fill="${color}"/>
    <rect x="40" y="24" width="22" height="54" rx="11" fill="${color}"/>
  </g>`;
}

function widgetEyesOpen() {
  return `
  <ellipse cx="196" cy="230" rx="27" ry="37" fill="${WIDGET_PALETTE.ink}"/>
  <ellipse cx="318" cy="230" rx="27" ry="37" fill="${WIDGET_PALETTE.ink}"/>`;
}

function widgetEyesHappy() {
  return `
  <path d="M 156 240 Q 196 210 236 240" fill="none" stroke="${WIDGET_PALETTE.ink}"
        stroke-width="19" stroke-linecap="round"/>
  <path d="M 278 240 Q 318 210 358 240" fill="none" stroke="${WIDGET_PALETTE.ink}"
        stroke-width="19" stroke-linecap="round"/>`;
}

/** One open eye, one closed — the wink in the streak tile of the reference. */
function widgetEyesWink() {
  return `
  <ellipse cx="196" cy="230" rx="27" ry="37" fill="${WIDGET_PALETTE.ink}"/>
  <path d="M 288 206 L 336 232 L 288 258" fill="none" stroke="${WIDGET_PALETTE.ink}"
        stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function widgetMascot({ fill, eyes, strip = WIDGET_PALETTE.strip }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W_W}" height="${W_H}" viewBox="0 0 ${W_W} ${W_H}">
  <path d="${DOME}" fill="${fill}"/>
${eyes}
${widgetStrips(strip, { x: 66, y: 74, rotate: -22 })}
</svg>`;
}

export const widgetMascots = () => [
  { name: "widget-mascot-cream",  svg: widgetMascot({ fill: WIDGET_PALETTE.cream,  eyes: widgetEyesHappy() }) },
  { name: "widget-mascot-pink",   svg: widgetMascot({ fill: WIDGET_PALETTE.pink,   eyes: widgetEyesHappy() }) },
  { name: "widget-mascot-blue",   svg: widgetMascot({ fill: WIDGET_PALETTE.blue,   eyes: widgetEyesWink() }) },
  { name: "widget-mascot-purple", svg: widgetMascot({ fill: WIDGET_PALETTE.purple, eyes: widgetEyesOpen(), strip: WIDGET_PALETTE.stripCool }) },
  { name: "widget-mascot-green",  svg: widgetMascot({ fill: WIDGET_PALETTE.green,  eyes: widgetEyesOpen() }) },
];

/* ------------------------------------------------- widget background plates */

/**
 * The background art, as one PNG per variation per widget family.
 *
 * [REPLACE-LATER] — placeholder art. Baked rather than drawn with SwiftUI
 * shapes for two reasons. The shapes in the reference are organic, not circles,
 * and SwiftUI gives a widget `Ellipse` and `Capsule` and nothing that bends;
 * and a plate the widget stretches edge to edge can never be the thing that
 * sizes a stack, which is what oversized `Ellipse`s were doing before (see the
 * note in TodaysPracticeWidget).
 *
 * One plate per family because the tiles are 1:1 and 2.14:1 — a single image
 * stretched between them would smear every shape.
 */

/** Mulberry32. Seeded so a rebake is byte-identical and the diff is reviewable. */
function prng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A closed organic shape: points on a circle with randomised radii, joined by a
 * Catmull-Rom spline converted to cubic beziers. The randomness is what stops
 * it reading as an ellipse — the spline is what stops it reading as a polygon.
 */
function blobPath(cx, cy, radius, rand, { lobes = 7, wobble = 0.34 } = {}) {
  const points = [];
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const r = radius * (1 - wobble / 2 + rand() * wobble);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  const at = (i) => points[(i + lobes) % lobes];
  let d = `M ${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < lobes; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    // Catmull-Rom -> cubic bezier, tension 1/6.
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `${d} Z`;
}

/** A confetti curl — a stroked spiral of about one and a half turns. */
function curlPath(cx, cy, r0, turns, rotate) {
  const steps = 48;
  const sweep = Math.PI * 2 * turns;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = rotate + t * sweep;
    const r = r0 * (0.28 + t * 0.9);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

/**
 * Where each plate's shapes sit, as fractions of the plate. Placed by hand
 * rather than scattered: the tiles have a text column on the left and a
 * character bottom-right, and a random layout would put a saturated shape
 * straight under the first line of the quote about a third of the time.
 */
const PLATES = {
  practiceSmall: {
    w: 158,
    h: 158,
    shapes: [
      { at: [-0.02, 0.06], r: 0.24, color: 0 },
      { at: [1.02, -0.02], r: 0.2, color: 1 },
      { at: [-0.04, 1.02], r: 0.26, color: 3 },
      { at: [0.94, 0.96], r: 0.3, color: 2 },
    ],
    curls: [{ at: [0.84, 0.15], r: 0.1, turns: 1.4, rotate: 0.6, color: 4 }],
  },
  practiceMedium: {
    w: 338,
    h: 158,
    shapes: [
      { at: [0.0, 0.04], r: 0.2, color: 0 },
      { at: [1.0, -0.04], r: 0.22, color: 1 },
      { at: [0.0, 1.02], r: 0.17, color: 3 },
      { at: [0.82, 0.66], r: 0.25, color: 2 },
      { at: [1.02, 1.0], r: 0.24, color: 0 },
    ],
    curls: [{ at: [0.87, 0.18], r: 0.07, turns: 1.5, rotate: 0.3, color: 4 }],
  },
  streak: {
    w: 158,
    h: 158,
    shapes: [
      { at: [-0.02, 0.0], r: 0.22, color: 1 },
      { at: [1.02, 0.1], r: 0.24, color: 0 },
      { at: [0.06, 1.04], r: 0.3, color: 2 },
      { at: [0.98, 1.02], r: 0.26, color: 3 },
    ],
    // No curl: the streak tile already spends its top-right corner on the
    // handwritten aside and its right edge on the heart.
    curls: [],
  },
};

/** Five pastels per story: four fills and the curl's stroke. */
const PLATE_COLOURS = {
  warm: ["#FFC9DB", "#FFE4B5", "#CFE0FB", "#EFE2FF", "#FFA8C0"],
  cool: ["#C7DBFB", "#FFE4B5", "#DFD2FA", "#FBD3E4", "#A9C4F5"],
  streakWarm: ["#FFD9E4", "#FFE4B5", "#D9EFD5", "#CFE0FB", "#FFA8C0"],
  streakCool: ["#CFE0FB", "#D6EFD8", "#DFD2FA", "#FBD3E4", "#A9C4F5"],
};

const PLATE_BASE = { warm: "#FFFCF7", cool: "#FBFCFF" };

function plate({ layout, colours, base, seed }) {
  const rand = prng(seed);
  const { w, h } = layout;
  const span = Math.max(w, h);

  const shapes = layout.shapes
    .map((s) =>
      `  <path d="${blobPath(s.at[0] * w, s.at[1] * h, s.r * span, rand)}" ` +
      `fill="${colours[s.color]}" fill-opacity="0.8"/>`,
    )
    .join("\n");

  const curls = (layout.curls ?? [])
    .map((c) =>
      `  <path d="${curlPath(c.at[0] * w, c.at[1] * h, c.r * span, c.turns, c.rotate)}" ` +
      `fill="none" stroke-opacity="0.85" stroke="${colours[c.color]}" stroke-width="${(span * 0.022).toFixed(1)}" ` +
      `stroke-linecap="round"/>`,
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${base}"/>
${shapes}
${curls}
</svg>`;
}

export const widgetPlates = () => [
  { name: "widget-bg-warm-small", layout: PLATES.practiceSmall,
    svg: plate({ layout: PLATES.practiceSmall, colours: PLATE_COLOURS.warm, base: PLATE_BASE.warm, seed: 20260918 }) },
  { name: "widget-bg-warm-medium", layout: PLATES.practiceMedium,
    svg: plate({ layout: PLATES.practiceMedium, colours: PLATE_COLOURS.warm, base: PLATE_BASE.warm, seed: 20260919 }) },
  { name: "widget-bg-cool-small", layout: PLATES.practiceSmall,
    svg: plate({ layout: PLATES.practiceSmall, colours: PLATE_COLOURS.cool, base: PLATE_BASE.cool, seed: 20260920 }) },
  { name: "widget-bg-cool-medium", layout: PLATES.practiceMedium,
    svg: plate({ layout: PLATES.practiceMedium, colours: PLATE_COLOURS.cool, base: PLATE_BASE.cool, seed: 20260921 }) },
  { name: "widget-bg-streak-warm", layout: PLATES.streak,
    svg: plate({ layout: PLATES.streak, colours: PLATE_COLOURS.streakWarm, base: PLATE_BASE.warm, seed: 20260922 }) },
  { name: "widget-bg-streak-cool", layout: PLATES.streak,
    svg: plate({ layout: PLATES.streak, colours: PLATE_COLOURS.streakCool, base: PLATE_BASE.cool, seed: 20260923 }) },
];
