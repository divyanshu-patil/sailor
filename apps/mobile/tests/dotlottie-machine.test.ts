import { describe, expect, it } from "vitest";

import { settle, withDefaults, type Machine } from "@/lib/dotlottie-machine";

// The shapes of two real Blooby files: `home-screen-buttons` (a boolean whose
// default pulls the initial state away) and `home` (a string over three states).
const buttons: Machine = {
  initial: "1",
  inputs: [{ name: "shouldPlayFirst", value: false }],
  states: [
    {
      name: "1",
      segment: "1",
      transitions: [
        {
          type: "Tweened",
          toState: "2",
          duration: 0.3,
          guards: [
            {
              type: "Boolean",
              inputName: "shouldPlayFirst",
              conditionType: "Equal",
              compareTo: false,
            },
          ],
        },
      ],
    },
    {
      name: "2",
      segment: "2",
      transitions: [
        {
          type: "Tweened",
          toState: "1",
          duration: 0.3,
          guards: [
            {
              type: "Boolean",
              inputName: "shouldPlayFirst",
              conditionType: "Equal",
              compareTo: true,
            },
          ],
        },
      ],
    },
  ],
};

const to = (state: string, value: string) => ({
  type: "Tweened" as const,
  toState: state,
  duration: 0.3,
  guards: [
    {
      type: "String" as const,
      inputName: "state",
      conditionType: "Equal" as const,
      compareTo: value,
    },
  ],
});

const home: Machine = {
  initial: "hiii",
  inputs: [{ name: "state", value: "default" }],
  states: [
    {
      name: "hiii",
      transitions: [to("expired", "expired"), to("expiring", "expiring")],
    },
    {
      name: "expired",
      transitions: [to("expiring", "expiring"), to("hiii", "default")],
    },
    {
      name: "expiring",
      transitions: [to("expired", "expired"), to("hiii", "default")],
    },
  ],
};

describe("dotLottie machine", () => {
  it("settles the initial state from the inputs, not the file's defaults", () => {
    const first = settle(
      buttons,
      buttons.initial,
      withDefaults(buttons, { shouldPlayFirst: true }),
    );
    expect(first.state.name).toBe("1");
    const second = settle(
      buttons,
      buttons.initial,
      withDefaults(buttons, { shouldPlayFirst: false }),
    );
    expect(second.state.name).toBe("2");
    expect(second.tween).toBe(0.3);
  });

  it("follows a string input between states and stays put when nothing matches", () => {
    expect(
      settle(home, "hiii", withDefaults(home, { state: "expired" })).state.name,
    ).toBe("expired");
    expect(
      settle(home, "expired", withDefaults(home, { state: "default" })).state
        .name,
    ).toBe("hiii");
    const still = settle(home, "hiii", withDefaults(home));
    expect(still.state.name).toBe("hiii");
    expect(still.tween).toBe(0);
  });
});
