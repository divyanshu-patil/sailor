/**
 * TEMPORARY profiling instrumentation — delete once the auth-flow jank is fixed.
 *
 * Samples requestAnimationFrame deltas across a navigation and posts the trace
 * to a collector on the dev host. The point is to separate the two candidates:
 * if the JS thread is stalling, the deltas spike here; if they stay near 16.7ms
 * while the push visibly stutters, the cost is on the native/UI thread and no
 * amount of JS work will fix it.
 */
const COLLECTOR = "http://localhost:8099/report";

type Mark = { name: string; t: number };

let frames: number[] = [];
let marks: Mark[] = [];
let running = false;
let t0 = 0;

/** Timestamps a moment inside the active probe window. */
export function mark(name: string) {
  if (running) marks.push({ name, t: Math.round((performance.now() - t0) * 10) / 10 });
}

export function startFrameProbe(label: string, durationMs = 2500) {
  if (running) return;
  running = true;
  frames = [];
  marks = [];
  t0 = performance.now();
  let last = t0;

  const tick = () => {
    const now = performance.now();
    frames.push(Math.round((now - last) * 10) / 10);
    last = now;
    if (now - t0 < durationMs) requestAnimationFrame(tick);
    else void finish(label);
  };
  requestAnimationFrame(tick);
}

async function finish(label: string) {
  running = false;
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  // 60fps budget. A delta over one budget means at least one frame never made it.
  const BUDGET = 16.7;

  const report = {
    label,
    frames: frames.length,
    spanMs: Math.round(frames.reduce((a, b) => a + b, 0)),
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted[sorted.length - 1] ?? 0,
    droppedFrames: frames.reduce((n, d) => n + Math.max(0, Math.round(d / BUDGET) - 1), 0),
    stalls: frames
      .map((d, i) => ({ i, d }))
      .filter((x) => x.d > BUDGET * 1.5)
      .slice(0, 60),
    marks,
    raw: frames,
  };

  console.log(`[frame-probe] ${label} p50=${report.p50} p95=${report.p95} max=${report.max} dropped=${report.droppedFrames}`);
  try {
    await fetch(COLLECTOR, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
  } catch (e) {
    console.log("[frame-probe] collector unreachable", String(e));
  }
}
