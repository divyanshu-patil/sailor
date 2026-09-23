import type { OnboardingState } from "@/types/onboarding";

/**
 * Decides which of two positions to keep when local and server disagree.
 *
 * Pure and side-effect free so it can be reasoned about and checked without a
 * device. The controller is what acts on the answer.
 */
export type ReconcileAction = "start_fresh" | "use_local" | "use_server";

export interface ReconcileResult {
  action: ReconcileAction;
  /** True when the server is behind and should be brought up to the local state. */
  needsServerSync: boolean;
}

function newer(a: OnboardingState, b: OnboardingState): "local" | "server" {
  const local = Date.parse(a.lastUpdatedAt);
  const server = Date.parse(b.lastUpdatedAt);
  // Equal or unparsable timestamps favour the server: it is the durable copy,
  // and adopting it costs at most a re-render, where syncing costs a request.
  return Number.isFinite(local) && local > server ? "local" : "server";
}

export function reconcile(
  local: OnboardingState | null,
  server: OnboardingState | null,
): ReconcileResult {
  if (!local && !server) return { action: "start_fresh", needsServerSync: true };
  if (!server) return { action: "use_local", needsServerSync: true };
  if (!local) return { action: "use_server", needsServerSync: false };

  // Completion dominates: a finished flow beats an unfinished one regardless of
  // timestamps, in either direction, because "done" cannot be un-done.
  if (server.status === "completed" && local.status !== "completed") {
    return { action: "use_server", needsServerSync: false };
  }
  if (local.status === "completed" && server.status !== "completed") {
    return { action: "use_local", needsServerSync: true };
  }

  return newer(local, server) === "local"
    ? { action: "use_local", needsServerSync: true }
    : { action: "use_server", needsServerSync: false };
}

/** The smallest thing that fails if the decision logic above breaks. Dev-only. */
export function runReconcileSelfCheck(): void {
  const base: OnboardingState = {
    userId: "u1",
    flowVersion: "2026-09",
    status: "in_progress",
    currentStepId: "profile_identity",
    data: {},
    completedSteps: [],
    lastUpdatedAt: "2026-09-23T10:00:00.000Z",
    completedAt: null,
  };
  const at = (iso: string, over: Partial<OnboardingState> = {}): OnboardingState => ({
    ...base,
    lastUpdatedAt: iso,
    ...over,
  });

  const cases: [string, OnboardingState | null, OnboardingState | null, ReconcileAction, boolean][] = [
    ["neither", null, null, "start_fresh", true],
    ["local only", at("2026-09-23T10:00:00.000Z"), null, "use_local", true],
    ["server only", null, at("2026-09-23T10:00:00.000Z"), "use_server", false],
    ["local newer", at("2026-09-23T10:05:00.000Z"), at("2026-09-23T10:00:00.000Z"), "use_local", true],
    ["server newer", at("2026-09-23T10:00:00.000Z"), at("2026-09-23T10:05:00.000Z"), "use_server", false],
    [
      "server completed beats newer local",
      at("2026-09-23T10:05:00.000Z"),
      at("2026-09-23T10:00:00.000Z", { status: "completed", currentStepId: null }),
      "use_server",
      false,
    ],
    [
      "local completed beats newer server",
      at("2026-09-23T10:00:00.000Z", { status: "completed", currentStepId: null }),
      at("2026-09-23T10:05:00.000Z"),
      "use_local",
      true,
    ],
  ];

  for (const [name, local, server, action, needsServerSync] of cases) {
    const result = reconcile(local, server);
    if (result.action !== action || result.needsServerSync !== needsServerSync) {
      throw new Error(
        `reconcile self-check failed for "${name}": got ${JSON.stringify(result)}`,
      );
    }
  }
}

if (__DEV__) runReconcileSelfCheck();
