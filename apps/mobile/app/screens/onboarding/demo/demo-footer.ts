/**
 * The demo's stages and what the frame's footer says in each — kept apart from
 * the components so the rules can be tested without a renderer.
 */

export type DemoPhase = "generating" | "completed";

export type DemoStage = "pick" | "delivery" | "output" | "script" | "deck";
export const DEMO_STAGES: DemoStage[] = [
  "pick",
  "delivery",
  "output",
  "script",
  "deck",
];

/** What the frame's footer should say while the demo is on screen. */
export interface DemoFooter {
  primary: string;
  secondary?: string;
  arrow?: boolean;
  enabled: boolean;
  /** A dial or a card has taken the screen; the footer steps aside. */
  hidden?: boolean;
}

/** The demo's answers to the frame's footer and back button. */
export interface DemoActions {
  primary: () => void;
  secondary: () => void;
  /** True when the demo handled back itself (an earlier stage, a closing card). */
  back: () => boolean;
}

/** How long the generating state holds before the stored result appears. Long
 *  enough to read as "it's working", short — the answer is already here. */
export const SCRIPT_HOLD_MS = 2200;
export const DECK_HOLD_MS = 1500;

/** The footer each stage shows. Pure, so it can be tested on its own. */
export function footerFor(
  stage: DemoStage,
  state: {
    selected: boolean;
    scriptPhase: DemoPhase;
    deckPhase: DemoPhase;
    focused: boolean;
  },
): DemoFooter {
  const hidden = state.focused;
  switch (stage) {
    case "pick":
      return {
        primary: "Use this brief",
        secondary: "Skip the demo",
        enabled: state.selected,
        hidden,
      };
    case "delivery":
      return { primary: "Next", arrow: true, enabled: true, hidden };
    case "output":
      return { primary: "Generate script", arrow: true, enabled: true, hidden };
    case "script":
      return state.scriptPhase === "completed"
        ? { primary: "Make my deck", arrow: true, enabled: true }
        : { primary: "Writing your script…", enabled: false };
    case "deck":
      return state.deckPhase === "completed"
        ? { primary: "Continue", arrow: true, enabled: true }
        : { primary: "Building your deck…", enabled: false };
  }
}
