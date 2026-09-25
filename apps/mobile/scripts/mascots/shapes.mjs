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
  { name: "widget-mascot-purple", svg: widgetMascot({ fill: WIDGET_PALETTE.purple, eyes: widgetEyesOpen(), strip: WIDGET_PALETTE.stripCool }) },
  { name: "widget-mascot-green",  svg: widgetMascot({ fill: WIDGET_PALETTE.green,  eyes: widgetEyesOpen() }) },
];

/**
 * The week-streak tile's character: a peach dome peeking over the day row.
 *
 * [REPLACE-LATER] — placeholder. Two PNGs on one canvas, because the tile
 * stacks them either side of the day card: the body behind it, the paws in
 * front, gripping its top edge. Swap both at the same size and they still line
 * up. Eyes at ~50% height (not the 64% of the domes above) since the bottom
 * third is hidden behind the card.
 */
const P_W = 400;
const P_H = 300;
const PEEK_INK = "#1E1C24";

export const widgetPeekBody = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${P_W}" height="${P_H}" viewBox="0 0 ${P_W} ${P_H}">
  <defs>
    <linearGradient id="peach" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#FDF0E4"/>
      <stop offset="1" stop-color="#F7DCC8"/>
    </linearGradient>
  </defs>
  <path d="M 44 ${P_H} C 40 150 118 56 212 56 C 306 56 380 150 372 ${P_H} Z" fill="url(#peach)"/>
  <ellipse cx="136" cy="190" rx="22" ry="12" fill="#F3A99A" opacity="0.45"/>
  <ellipse cx="292" cy="186" rx="22" ry="12" fill="#F3A99A" opacity="0.45"/>
  <path d="M 150 170 Q 176 128 202 170" fill="none" stroke="${PEEK_INK}" stroke-width="17" stroke-linecap="round"/>
  <path d="M 236 164 Q 262 122 288 164" fill="none" stroke="${PEEK_INK}" stroke-width="17" stroke-linecap="round"/>
  <g fill="#F5C95C">
    <rect x="0" y="0" width="46" height="16" rx="8" transform="translate(42 92) rotate(30)"/>
    <rect x="0" y="0" width="42" height="16" rx="8" transform="translate(114 34) rotate(64)"/>
  </g>
</svg>`;

export const widgetPeekPaws = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${P_W}" height="${P_H}" viewBox="0 0 ${P_W} ${P_H}">
  <ellipse cx="0" cy="0" rx="33" ry="36" fill="${PEEK_INK}" transform="translate(96 236) rotate(-18)"/>
  <path d="M 294 238 C 290 206 322 192 350 200 C 372 206 384 224 376 238 C 366 256 336 262 316 258 C 302 255 295 248 294 238 Z" fill="${PEEK_INK}"/>
  <ellipse cx="86" cy="222" rx="10" ry="6" fill="#FFFFFF" opacity="0.14" transform="rotate(-30 86 222)"/>
  <ellipse cx="336" cy="210" rx="10" ry="5" fill="#FFFFFF" opacity="0.14" transform="rotate(-12 336 210)"/>
</svg>`;

/** The week tile's flame: a warm coral outer with a dusky core, softer than
 *  the small tile's orange-and-yellow. Same 1:1 canvas as widgetFlame. */
export const widgetFlameSoft = () => `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <defs>
    <linearGradient id="outer" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F7B48E"/>
      <stop offset="1" stop-color="#E9805E"/>
    </linearGradient>
    <linearGradient id="core" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C47585"/>
      <stop offset="1" stop-color="#9C5470"/>
    </linearGradient>
  </defs>
  <g transform="translate(15 0)">
  <path d="M 60 6 C 76 34 96 44 104 70 C 114 102 92 144 60 144
           C 28 144 6 102 16 70 C 23 47 40 40 48 20
           C 54 34 52 46 60 56 C 66 44 64 24 60 6 Z" fill="url(#outer)"/>
  <path d="M 60 72 C 70 86 80 94 80 110 C 80 126 71 136 60 136
           C 49 136 40 126 40 110 C 40 97 49 90 53 78
           C 56 86 56 92 60 98 C 63 90 62 80 60 72 Z" fill="url(#core)"/>
  </g>
</svg>`;

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

/** Five pastels: four fills and the curl's stroke. */
const PLATE_COLOURS = {
  practice: ["#C7DBFB", "#FFE4B5", "#DFD2FA", "#FBD3E4", "#A9C4F5"],
  streak: ["#CFE0FB", "#D6EFD8", "#DFD2FA", "#FBD3E4", "#A9C4F5"],
};

const PLATE_BASE = "#FBFCFF";

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
  { name: "widget-bg-cool-small", layout: PLATES.practiceSmall,
    svg: plate({ layout: PLATES.practiceSmall, colours: PLATE_COLOURS.practice, base: PLATE_BASE, seed: 20260920 }) },
  { name: "widget-bg-cool-medium", layout: PLATES.practiceMedium,
    svg: plate({ layout: PLATES.practiceMedium, colours: PLATE_COLOURS.practice, base: PLATE_BASE, seed: 20260921 }) },
  { name: "widget-bg-streak-cool", layout: PLATES.streak,
    svg: plate({ layout: PLATES.streak, colours: PLATE_COLOURS.streak, base: PLATE_BASE, seed: 20260923 }) },
];

/* --------------------------------------------------------------- the flame */

/**
 * The streak flame.
 *
 * [REPLACE-LATER] — placeholder art. A PNG rather than SF Symbols' `flame.fill`
 * because the symbol is a single flat tint: the reference flame has a lighter
 * core inside a warmer outer, and that two-tone is most of what makes it read
 * as fire rather than as a leaf.
 *
 * Square canvas with the 4:5 drawing centred in it, because the widget draws it
 * in a 1:1 frame — a 4:5 plate there would stretch it.
 */
export const widgetFlame = () => `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g transform="translate(15 0)">
  <path d="M 60 6 C 76 34 96 44 104 70 C 114 102 92 144 60 144
           C 28 144 6 102 16 70 C 23 47 40 40 48 20
           C 54 34 52 46 60 56 C 66 44 64 24 60 6 Z"
        fill="#FF7A3D"/>
  <path d="M 60 62 C 70 78 82 88 82 104 C 82 124 72 136 60 136
           C 48 136 38 124 38 104 C 38 90 48 80 52 68
           C 56 78 55 86 60 92 C 64 84 62 72 60 62 Z"
        fill="#FFC93C"/>
  </g>
</svg>`;

/* ------------------------------------------------------------ empty states */

/**
 * Discover's empty and error characters. [REPLACE-LATER] like the rest.
 *
 * Character and props only — the pastel cloud behind each one is a shapesoup
 * blob drawn live by the screen, so it can breathe instead of being baked in.
 */
const STATE_INK = "#1B1B23";

export function mascotEmpty() {
  const box = {
    left: "#B9ADF7",
    right: "#A091F0",
    inside: "#8574E3",
    flap: "#CDC4FB",
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420">
  <ellipse cx="275" cy="396" rx="190" ry="12" fill="#1B1B23" opacity="0.06"/>

  <!-- feet -->
  <rect x="150" y="332" width="34" height="62" rx="14" fill="${STATE_INK}"/>
  <rect x="222" y="336" width="34" height="58" rx="14" fill="${STATE_INK}"/>

  <!-- body -->
  <path d="M 214 58 C 318 54 382 130 380 222 C 378 312 312 360 214 360
           C 118 360 60 300 62 214 C 64 124 116 62 214 58 Z"
        fill="#F7F4EF" stroke="#E7E0D6" stroke-width="5"/>
  <path d="M 110 150 C 130 104 170 84 206 80" fill="none" stroke="#FFFFFF"
        stroke-width="14" stroke-linecap="round" opacity="0.9"/>

  <!-- eyes, glancing at the box -->
  <ellipse cx="226" cy="196" rx="21" ry="33" fill="${STATE_INK}" transform="rotate(-8 226 196)"/>
  <ellipse cx="292" cy="192" rx="21" ry="33" fill="${STATE_INK}" transform="rotate(-8 292 192)"/>
  <ellipse cx="233" cy="181" rx="6" ry="8" fill="#FFFFFF"/>
  <ellipse cx="299" cy="177" rx="6" ry="8" fill="#FFFFFF"/>

  <!-- raised arm -->
  <path d="M 52 236 C 34 226 30 200 46 188 C 62 176 84 190 86 212
           C 88 232 70 246 52 236 Z" fill="${STATE_INK}"/>

  <!-- strips -->
  <g transform="translate(348 34) rotate(30)">
    <rect x="0" y="0" width="16" height="50" rx="8" fill="${PALETTE.mustard}"/>
    <rect x="30" y="16" width="16" height="36" rx="8" fill="${PALETTE.mustard}"/>
  </g>

  <!-- box -->
  <polygon points="262,248 350,212 332,176 244,212" fill="${box.flap}"/>
  <polygon points="350,212 450,238 474,200 374,176" fill="${box.flap}"/>
  <polygon points="262,248 350,212 450,238 362,276" fill="${box.inside}"/>
  <polygon points="262,248 362,276 362,392 262,356" fill="${box.left}"/>
  <polygon points="362,276 450,238 450,352 362,392" fill="${box.right}"/>
  <polygon points="362,276 450,238 488,262 400,302" fill="${box.flap}"/>
  <polygon points="262,248 362,276 336,300 238,270" fill="${box.flap}" opacity="0.95"/>

  <!-- hand over the rim -->
  <path d="M 286 250 C 276 230 288 208 310 208 C 332 208 344 228 336 248
           C 330 264 294 266 286 250 Z" fill="${STATE_INK}"/>

  <!-- doodle star -->
  <path d="M 46 316 L 55 338 L 78 340 L 60 354 L 66 377 L 46 364 L 26 377
           L 32 354 L 14 340 L 37 338 Z" fill="none" stroke="#A99CF4"
        stroke-width="5" stroke-linejoin="round"/>
</svg>`;
}

/** A spiral that narrows as it falls — the "dizzy" squiggle over the head. */
function dizzyPath(cx, top) {
  const steps = 90;
  const turns = 3.2;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const r = 44 * (1 - t * 0.8);
    const x = cx + Math.cos(angle) * r;
    const y = top + t * 96 + Math.sin(angle) * r * 0.32;
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

export function mascotError() {
  const blue = "#7EADF6";
  const paw = "#A8C9FB";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420">
  <ellipse cx="260" cy="394" rx="200" ry="13" fill="#1B1B23" opacity="0.06"/>

  <!-- body: a dome slumped flat on the floor -->
  <path d="M 116 380 C 100 232 164 140 262 140 C 360 140 424 232 408 380
           C 330 392 194 392 116 380 Z" fill="${blue}"/>
  <path d="M 170 214 C 190 184 220 168 254 164" fill="none" stroke="#A9CAFB"
        stroke-width="14" stroke-linecap="round"/>

  <!-- closed, sorry eyes and a small frown -->
  <path d="M 196 266 Q 219 290 242 266" fill="none" stroke="${STATE_INK}"
        stroke-width="10" stroke-linecap="round"/>
  <path d="M 282 266 Q 305 290 328 266" fill="none" stroke="${STATE_INK}"
        stroke-width="10" stroke-linecap="round"/>
  <path d="M 248 312 Q 262 300 276 312" fill="none" stroke="${STATE_INK}"
        stroke-width="7" stroke-linecap="round"/>

  <!-- paws -->
  <ellipse cx="136" cy="366" rx="44" ry="28" fill="${paw}"/>
  <ellipse cx="390" cy="366" rx="44" ry="28" fill="${paw}"/>

  <!-- dizzy spiral -->
  <path d="${dizzyPath(262, 22)}" fill="none" stroke="#3E4A6E" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>

  <!-- exclamation -->
  <g transform="rotate(18 440 110)">
    <rect x="428" y="56" width="22" height="74" rx="11" fill="#F27BA7"/>
    <circle cx="439" cy="152" r="12" fill="#F27BA7"/>
  </g>
</svg>`;
}

/* ---------------------------------------------------------- search states */

/**
 * The Search tab's character: a clean mint bean — a body and two solid eyes,
 * nothing else. No limbs, brows, pupils or cheeks; the props around it carry
 * the story. A different creature from Discover's on purpose.
 * [REPLACE-LATER] like the rest.
 */
const MINT = { body: "#8ED8B4", shade: "#74C9A0" };
const LENS = { rim: "#7C6BD9", glass: "#DCEEFF" };

const bean = () => `
  <path d="M 222 60 C 316 58 358 146 356 240 C 354 334 306 380 222 380
           C 138 380 88 334 88 240 C 88 146 128 62 222 60 Z" fill="${MINT.body}"/>
  <path d="M 326 146 C 352 194 356 272 330 324 C 310 362 272 376 238 378
           C 304 350 336 266 326 146 Z" fill="${MINT.shade}" opacity="0.6"/>
  <path d="M 124 180 C 132 132 162 96 204 86" fill="none" stroke="#FFFFFF"
        stroke-width="13" stroke-linecap="round" opacity="0.55"/>`;

const sparkle = (x, y, r, fill) =>
  `<path d="M ${x} ${y - r} Q ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}
           Q ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}
           Q ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}
           Q ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${fill}"/>`;

export function mascotSearch() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420">
  <ellipse cx="236" cy="396" rx="160" ry="11" fill="#1B1B23" opacity="0.06"/>
  ${bean()}
  <!-- eyes, glancing toward the glass -->
  <ellipse cx="206" cy="212" rx="20" ry="32" fill="${STATE_INK}"/>
  <ellipse cx="272" cy="212" rx="20" ry="32" fill="${STATE_INK}"/>
  <!-- magnifying glass, floating beside it -->
  <g transform="rotate(-18 420 196)">
    <line x1="420" y1="262" x2="420" y2="322" stroke="${LENS.rim}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="420" cy="196" r="62" fill="${LENS.glass}" opacity="0.85" stroke="${LENS.rim}" stroke-width="16"/>
    <path d="M 386 176 Q 394 150 420 144" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
  </g>
  ${sparkle(482, 70, 18, PALETTE.mustard)}
  ${sparkle(56, 110, 12, "#A99CF4")}
  <circle cx="486" cy="330" r="7" fill="#F9B4CB"/>
</svg>`;
}

export function mascotNoResults() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420">
  <ellipse cx="256" cy="396" rx="186" ry="11" fill="#1B1B23" opacity="0.06"/>
  ${bean()}
  <!-- eyes squeezed flat: nothing found -->
  <rect x="172" y="220" width="46" height="16" rx="8" fill="${STATE_INK}"/>
  <rect x="244" y="220" width="46" height="16" rx="8" fill="${STATE_INK}"/>
  <!-- sweat drop -->
  <path d="M 338 104 C 352 124 356 138 346 146 C 336 154 324 144 328 132 C 330 124 334 114 338 104 Z"
        fill="#9ED0F7"/>
  <!-- question mark doodle -->
  <path d="M 108 50 C 108 22 154 20 154 48 C 154 68 130 70 130 90" fill="none"
        stroke="#A99CF4" stroke-width="10" stroke-linecap="round"/>
  <circle cx="130" cy="114" r="7" fill="#A99CF4"/>
  <!-- the glass, dropped on its side, empty -->
  <g transform="rotate(38 440 340)">
    <line x1="440" y1="384" x2="440" y2="416" stroke="${LENS.rim}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="440" cy="340" r="42" fill="${LENS.glass}" opacity="0.85" stroke="${LENS.rim}" stroke-width="13"/>
  </g>
  <circle cx="484" cy="196" r="6" fill="#F9B4CB"/>
  ${sparkle(56, 318, 11, PALETTE.mustard)}
</svg>`;
}
