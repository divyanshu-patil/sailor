/**
 * The two-dial picker's arithmetic: where each value sits on its ring, which
 * value a rotation lands on, and the 24h <-> dial conversions. Worklets so the
 * gesture can call them on the UI thread; plain functions everywhere else.
 */

export const COUNT = 12;
export const STEP = (2 * Math.PI) / COUNT;
export const SPRING = { damping: 70 };
export const RING = "#ECE3D7";
export const FADED = "#BFB6AA";

export const HOURS = Array.from({ length: COUNT }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
export const MINUTES = Array.from({ length: COUNT }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

/** "18:05" → the dials' positions and the period. Minutes round to 5. */
export function splitTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour24 = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 18;
  const minute = Number.isFinite(m) ? (Math.round(m / 5) * 5) % 60 : 0;
  return {
    hourIndex: (hour24 + 11) % 12,
    minuteIndex: minute / 5,
    period: (hour24 < 12 ? "AM" : "PM") as "AM" | "PM",
  };
}

export function joinTime(
  hourIndex: number,
  minuteIndex: number,
  period: "AM" | "PM",
) {
  const hour24 = ((hourIndex + 1) % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minuteIndex * 5).padStart(2, "0")}`;
}

export type Side = "left" | "right";

/*
 * The geometry, as fractions of the ring's outer radius R. Taken from the
 * reference: the rings overlap a little at the centre, so their bands cross
 * above and below the colon — the marker sits on the upper crossing — and the
 * numbers ride an inner arc at half the radius, 30° apart.
 */
export const BAND = 0.16;
export const OVERLAP = 0.11;
export const TEXT_RADIUS = 0.5;
/** Where the bands' midlines cross, above the centre row. */
export const CROSSING = Math.sqrt(
  2 * (1 - BAND / 2) * (OVERLAP - BAND / 2) - (OVERLAP - BAND / 2) ** 2,
);

/** The angle a value sits at. Left: selection points right (0), higher values
 *  above it. Right: selection points left (π), higher values above it. */
export function angleOf(side: Side, index: number, rotation: number) {
  "worklet";
  return side === "left"
    ? -index * STEP + rotation
    : Math.PI + index * STEP + rotation;
}

export function indexAt(side: Side, rotation: number) {
  "worklet";
  const raw = side === "left" ? rotation / STEP : -rotation / STEP;
  return ((Math.round(raw) % COUNT) + COUNT) % COUNT;
}

export function rotationFor(side: Side, index: number, near: number) {
  "worklet";
  const base = side === "left" ? index * STEP : -index * STEP;
  const turns = Math.round((near - base) / (2 * Math.PI));
  return base + turns * 2 * Math.PI;
}

/** Signed distance from the selection angle, in (-π, π]. */
export function fromSelection(side: Side, angle: number) {
  "worklet";
  const d = angle - (side === "left" ? 0 : Math.PI);
  return Math.atan2(Math.sin(d), Math.cos(d));
}
