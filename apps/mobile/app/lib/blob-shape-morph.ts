import { _layout, _marks, fadeHex } from "blobatar/internal";

/**
 * Literal shape morphing between two generated Blobatars.
 *
 * The library's own morph only interpolates an expression's thirteen pose
 * channels; a change of *name* is a different creature and it deliberately
 * cuts. This walks the thing that actually differs between two names — the
 * drawn geometry — by sampling every path to a fixed number of points and
 * lerping point for point, so a face dissolves into the next one instead of
 * swapping.
 *
 * Still pure: no React, no react-native-svg, no native imports, so it can be
 * exercised outside the app.
 */

/** Points per sampled path. Enough that a 100-unit path reads as a curve. */
const SAMPLES = 64;
/** Subdivisions per Bézier while flattening, before arc-length resampling. */
const SUBSTEPS = 16;

export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface BlobFigure {
  /** Silhouette lobes (sun, cloud, nub, capsule caps). */
  petals: Circle[];
  /** Extra head-filled outlines, e.g. a droplet's taper. */
  extras: Point[][];
  /** The core body, sampled to `SAMPLES` points. */
  body: Point[];
  /** The two eyes, sampled to `SAMPLES` points each. */
  eyes: Point[][];
  head: string;
  eye: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function tokens(d: string): string[] {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
}

/** Every path Blobatar emits uses M/C/Q/L/H/V/Z, absolute and explicit. */
function flatten(d: string): Point[] {
  const t = tokens(d);
  let i = 0;
  let cx = 0;
  let cy = 0;
  const out: Point[] = [];

  const lineTo = (x: number, y: number) => {
    out.push({ x, y });
    cx = x;
    cy = y;
  };
  const cubic = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) => {
    const x0 = cx;
    const y0 = cy;
    for (let s = 1; s <= SUBSTEPS; s++) {
      const u = s / SUBSTEPS;
      const m = 1 - u;
      out.push({
        x: m * m * m * x0 + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x,
        y: m * m * m * y0 + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y,
      });
    }
    cx = x;
    cy = y;
  };
  const quad = (x1: number, y1: number, x: number, y: number) => {
    const x0 = cx;
    const y0 = cy;
    for (let s = 1; s <= SUBSTEPS; s++) {
      const u = s / SUBSTEPS;
      const m = 1 - u;
      out.push({
        x: m * m * x0 + 2 * m * u * x1 + u * u * x,
        y: m * m * y0 + 2 * m * u * y1 + u * u * y,
      });
    }
    cx = x;
    cy = y;
  };

  while (i < t.length) {
    const cmd = t[i++];
    switch (cmd) {
      case "M":
      case "m": {
        const rel = cmd === "m";
        const x = Number(t[i++]) + (rel ? cx : 0);
        const y = Number(t[i++]) + (rel ? cy : 0);
        out.push({ x, y });
        cx = x;
        cy = y;
        break;
      }
      case "C":
      case "c": {
        const rel = cmd === "c";
        const ox = rel ? cx : 0;
        const oy = rel ? cy : 0;
        cubic(
          Number(t[i++]) + ox,
          Number(t[i++]) + oy,
          Number(t[i++]) + ox,
          Number(t[i++]) + oy,
          Number(t[i++]) + ox,
          Number(t[i++]) + oy,
        );
        break;
      }
      case "Q":
      case "q": {
        const rel = cmd === "q";
        const ox = rel ? cx : 0;
        const oy = rel ? cy : 0;
        quad(
          Number(t[i++]) + ox,
          Number(t[i++]) + oy,
          Number(t[i++]) + ox,
          Number(t[i++]) + oy,
        );
        break;
      }
      case "L":
      case "l": {
        const rel = cmd === "l";
        lineTo(
          Number(t[i++]) + (rel ? cx : 0),
          Number(t[i++]) + (rel ? cy : 0),
        );
        break;
      }
      case "H":
      case "h": {
        lineTo(Number(t[i++]) + (cmd === "h" ? cx : 0), cy);
        break;
      }
      case "V":
      case "v": {
        lineTo(cx, Number(t[i++]) + (cmd === "v" ? cy : 0));
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Resamples a polyline to exactly `k` points, evenly by arc length. */
function resample(poly: Point[], k: number): Point[] {
  if (poly.length === 0) return Array.from({ length: k }, () => ({ x: 0, y: 0 }));
  if (poly.length === 1)
    return Array.from({ length: k }, () => ({ ...poly[0] }));

  const dist = [0];
  for (let i = 1; i < poly.length; i++) {
    dist.push(
      dist[i - 1] +
        Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y),
    );
  }
  const total = dist[dist.length - 1];
  if (total === 0) return Array.from({ length: k }, () => ({ ...poly[0] }));

  const out: Point[] = [];
  let seg = 1;
  for (let j = 0; j < k; j++) {
    const target = (total * j) / (k - 1);
    while (seg < poly.length - 1 && dist[seg] < target) seg++;
    const d0 = dist[seg - 1];
    const d1 = dist[seg];
    const f = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
    out.push({
      x: poly[seg - 1].x + (poly[seg].x - poly[seg - 1].x) * f,
      y: poly[seg - 1].y + (poly[seg].y - poly[seg - 1].y) * f,
    });
  }
  return out;
}

export function samplePath(d: string): Point[] {
  return resample(flatten(d), SAMPLES);
}

/** A closed polyline as an SVG path. */
export function pathFromPoints(pts: Point[]): string {
  if (pts.length === 0) return "";
  let d = `M${round2(pts[0].x)} ${round2(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${round2(pts[i].x)} ${round2(pts[i].y)}`;
  }
  return `${d}Z`;
}

/** The drawn geometry of one name, ready to lerp. */
export function figureFor(seed: string): BlobFigure {
  const layout = _layout(seed);
  const { marks } = _marks(seed);
  const petals = layout.petals.length;
  const extras = layout.extra.length;
  const pathAt = (index: number) => {
    const mark = marks[index];
    return mark && mark.kind === "path" ? mark.d : "";
  };

  return {
    petals: layout.petals.map(({ cx, cy, r }) => ({ cx, cy, r })),
    extras: Array.from({ length: extras }, (_, j) =>
      samplePath(pathAt(petals + j)),
    ),
    body: samplePath(pathAt(petals + extras)),
    eyes: layout.eyes.map((_, j) => samplePath(pathAt(petals + extras + 1 + j))),
    head: layout.palette.head ?? "#1C1A18",
    eye: layout.palette.eye ?? "#1C1A18",
  };
}

function centroid(pts: Point[]): Point {
  if (pts.length === 0) return { x: 50, y: 50 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function degenerate(pts: Point[]): Point[] {
  const c = centroid(pts);
  return Array.from({ length: pts.length || SAMPLES }, () => c);
}

function lerpPoints(a: Point[], b: Point[], t: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < a.length; i++) {
    out.push({ x: a[i].x + (b[i].x - a[i].x) * t, y: a[i].y + (b[i].y - a[i].y) * t });
  }
  return out;
}

function lerpPaths(a: Point[][], b: Point[][], t: number): Point[][] {
  const n = Math.max(a.length, b.length);
  const out: Point[][] = [];
  for (let i = 0; i < n; i++) {
    const pa = a[i];
    const pb = b[i];
    if (pa && pb) out.push(lerpPoints(pa, pb, t));
    else if (pa) out.push(lerpPoints(pa, degenerate(pa), t));
    else out.push(lerpPoints(degenerate(pb), pb, t));
  }
  return out;
}

function lerpCircles(a: Circle[], b: Circle[], t: number): Circle[] {
  const n = Math.max(a.length, b.length);
  const out: Circle[] = [];
  for (let i = 0; i < n; i++) {
    const ca = a[i];
    const cb = b[i];
    if (ca && cb) {
      out.push({
        cx: ca.cx + (cb.cx - ca.cx) * t,
        cy: ca.cy + (cb.cy - ca.cy) * t,
        r: ca.r + (cb.r - ca.r) * t,
      });
    } else if (ca) {
      out.push({ cx: ca.cx, cy: ca.cy, r: ca.r * (1 - t) });
    } else {
      out.push({ cx: cb.cx, cy: cb.cy, r: cb.r * t });
    }
  }
  return out;
}

/** A figure `t` of the way from `a` to `b`. */
export function lerpFigure(a: BlobFigure, b: BlobFigure, t: number): BlobFigure {
  return {
    petals: lerpCircles(a.petals, b.petals, t),
    extras: lerpPaths(a.extras, b.extras, t),
    body: lerpPoints(a.body, b.body, t),
    eyes: lerpPaths(a.eyes, b.eyes, t),
    head: fadeHex(a.head, b.head, t),
    eye: fadeHex(a.eye, b.eye, t),
  };
}
