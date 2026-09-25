import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@/screens/presentation/generation/preview/components/script-text/text-layout",
  () => ({
    // One line per segment group, a fixed line height — enough to see the
    // measuring logic place blocks, without Skia's font machinery.
    layoutText: (lines: unknown[], _fonts: unknown, _width: number, lineHeight: number) => ({
      height: lines.length * lineHeight,
    }),
  }),
);

import { MIGRATIONS, SCHEMA_VERSION, TABLES } from "@/db/schema";
import {
  cardToStoredCard,
  cardToUpsert,
  deckDetailToUpsert,
  deckItemToUpsert,
  deckSummaryToUpsert,
} from "@/db/mappers";
import { mark, startFrameProbe } from "@/lib/frame-probe";
import { pageTarget, resist, rubberBand } from "@/screens/daily-practice/reel";
import { generatingMessages } from "@/screens/presentation/generation/preview/components/generating/constants";
import {
  headingScale,
  measureBlocks,
  sweptHeight,
} from "@/screens/presentation/generation/preview/components/script-text/block-metrics";
import {
  QUOTE_BORDER_WIDTH,
  REVEAL,
  SCRIPT_TEXT_VARIANT,
} from "@/screens/presentation/generation/preview/components/script-text/config";
import {
  assignImpactColors,
  getImpactTier,
  IMPACT_PALETTES,
} from "@/screens/presentation/script-practice/utils/colorAssignment";
import { getCardsProgressInfoText } from "@/screens/presentation/script-practice/utils/getCardsProgressInfoText";
import {
  formatDelivery,
  getDeliveryEmoji,
} from "@/screens/presentation/script-practice/utils/getDeliveryEmoji";
import { lightenColor } from "@/screens/presentation/script-practice/utils/lightenColor";
import { speedLabel, TELEPROMPTER } from "@/screens/presentation/teleprompter/config";
import { toPromptLines } from "@/screens/presentation/teleprompter/lines";
import { demo, splitSentences } from "@/screens/presentation/teleprompter/sentences";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "@/screens/profile/theme";
import { parseBlocks } from "@/utils/parseInlineMarkdown";

describe("teleprompter", () => {
  it("splits sentences without losing text", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
    expect(splitSentences('She said "go." Then left.')).toEqual(['She said "go."', "Then left."]);
    expect(splitSentences("It grew 1.5 times.")).toEqual(["It grew 1.5 times."]);
    expect(splitSentences("   ")).toEqual([]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => demo()).not.toThrow();
  });

  it("turns a script into prompt lines", () => {
    const lines = toPromptLines(
      ["## [HOOK] · ~25s ##", "First. Second **bold**.", "", "> *(pause)*", ">   ", "##   ", "Tail line"].join("\n"),
    );
    expect(lines.map((l) => l.kind)).toEqual(["note", "line", "line", "aside", "line"]);
    expect(lines[0].text).toBe("[HOOK] · ~25s");
    expect(lines[1].startsBlock).toBe(true);
    expect(lines[2].startsBlock).toBe(false);
    expect(speedLabel(1.5)).toBe("1.5x");
    expect(TELEPROMPTER.speeds).toContain(TELEPROMPTER.defaultSpeed);
  });
});

describe("script practice", () => {
  it("tiers impact and colours cards stably", () => {
    expect(getImpactTier(0)).toBe(0);
    expect(getImpactTier(0.95)).toBe(4);
    expect(getImpactTier(Number.NaN)).toBe(2);
    const [a, b] = assignImpactColors([
      { id: "abc", impact: 0.1 } as never,
      { id: "abc", impact: 0.1 } as never,
    ]);
    expect(a.color).toBe(b.color);
    expect(IMPACT_PALETTES[a.tier]).toContain(a.color);
  });

  it("labels progress, deliveries and colours", () => {
    expect(getCardsProgressInfoText({ currentIndex: 2, totalCards: 5 })).toBe("3/5");
    expect(getCardsProgressInfoText({ currentIndex: 5, totalCards: 5 })).toBe("End");
    expect(getDeliveryEmoji("calm")).toBe("🌿");
    expect(getDeliveryEmoji("unheard-of" as never)).toBe("🎙️");
    expect(formatDelivery("step_by_step")).toBe("step by step");
    expect(lightenColor("#000000")).toMatch(/^#/);
    expect(lightenColor("#000000", 0.5)).not.toBe(lightenColor("#000000"));
  });
});

describe("daily practice reel", () => {
  it("resists past the ends", () => {
    expect(resist(0, 10)).toBe(0);
    expect(resist(10, 0)).toBe(0);
    expect(resist(10, 10)).toBe(5);
    expect(rubberBand(5, 0, 10, 10)).toBe(5);
    expect(rubberBand(-10, 0, 10, 10)).toBe(-5);
    expect(rubberBand(20, 0, 10, 10)).toBe(15);
  });

  it("commits a page on distance or a flick", () => {
    expect(pageTarget(1, 1.1, 0, 3, 0.3, 1)).toBe(1);
    expect(pageTarget(1, 1.5, 0, 3, 0.3, 1)).toBe(2);
    expect(pageTarget(1, 1.1, -5, 3, 0.3, 1)).toBe(0);
    expect(pageTarget(3, 3.5, 0, 3, 0.3, 1)).toBe(3);
    expect(pageTarget(1, 1, 0, 3, 0, 1)).toBe(1);
  });
});

describe("script text layout", () => {
  it("places headings, quotes and paragraphs within the budget", () => {
    const blocks = parseBlocks("# Big\n\n## Small\n\n> quoted\n> twice\n\nA paragraph.");
    const metrics = measureBlocks({
      blocks,
      fonts: {} as never,
      width: 300,
      fontSize: 10,
      lineHeightMultiplier: 1,
      paragraphSpacing: 5,
      quoteSpacing: 3,
      quoteIndent: 8,
      justify: true,
      budget: 1000,
      maxBlocks: 10,
    });
    expect(metrics).toHaveLength(4);
    expect(metrics[0].height).toBe(15);
    expect(metrics[1].height).toBeCloseTo(12.2);
    expect(metrics[2]).toMatchObject({ left: 8 + QUOTE_BORDER_WIDTH, height: 20 });
    expect(sweptHeight(metrics)).toBe(metrics[3].top + metrics[3].height);
    expect(sweptHeight([])).toBe(0);
    expect(headingScale(1)).toBe(1.5);
  });

  it("stops at the budget and the block cap", () => {
    const blocks = parseBlocks("One.\n\nTwo.\n\nThree.");
    const base = {
      blocks, fonts: {} as never, width: 0, fontSize: 10, lineHeightMultiplier: 1,
      paragraphSpacing: 0, quoteSpacing: 0, quoteIndent: 400, justify: false,
    };
    expect(measureBlocks({ ...base, budget: 5, maxBlocks: 10 })).toHaveLength(1);
    expect(measureBlocks({ ...base, budget: 1000, maxBlocks: 2 })).toHaveLength(2);
    expect(SCRIPT_TEXT_VARIANT).toBeTruthy();
    expect(REVEAL).toBeTruthy();
    expect(generatingMessages.length).toBeGreaterThan(1);
  });
});

describe("local database mapping", () => {
  const card = {
    id: 1, deck_id: 2, position: 1, title: "T", description: "D", keywords: null,
    color: "#fff", impact: 0.5, delivery: "calm", version: 3,
  };

  it("maps API shapes to stored rows", () => {
    expect(deckSummaryToUpsert({ id: 1, title: null, description: "d", color: "#fff", durationMins: 2, slideCount: 3, isFavourite: true, updatedAt: "u" } as never))
      .toMatchObject({ id: "1", title: "" });
    const detail = deckDetailToUpsert({ id: 1, title: null, description: null, script: "s", color: "#fff", duration_mins: 2, card_count: 3, is_favorite: false, created_at: "c", updated_at: "u" } as never);
    expect(detail).toMatchObject({ title: "", description: "", isPublic: null, tags: null, generationStatus: null });
    expect(deckDetailToUpsert({ id: 1, title: "T", description: "D", is_public: true, tags: ["a"], category: "sales", practice_count: 1, save_count: 2, generation_status: "completed" } as never))
      .toMatchObject({ title: "T", isPublic: true, tags: ["a"], saveCount: 2 });
    expect(cardToStoredCard(card as never)).toMatchObject({ id: "1", deckId: "2", keywords: [], text: "T" });
    expect(cardToStoredCard({ ...card, keywords: ["k"] } as never).keywords).toEqual(["k"]);
    expect(cardToUpsert(card as never)).toMatchObject({ keywords: [], createdAt: null, updatedAt: null });
    expect(cardToUpsert({ ...card, keywords: ["k"], created_at: "c", updated_at: "u" } as never)).toMatchObject({ createdAt: "c" });
    expect(deckItemToUpsert({ id: "1", title: "T", description: "", color: "#fff", durationMins: 1, slideCount: 1, updatedAt: "u" } as never))
      .toMatchObject({ isFavourite: null, isPublic: null });
    expect(deckItemToUpsert({ id: "1", title: "T", description: "", color: "#fff", durationMins: 1, slideCount: 1, updatedAt: "u", isFavourite: true, isPublic: false, tags: [], category: "x", practiceCount: 1, saveCount: 1 } as never))
      .toMatchObject({ isFavourite: true, isPublic: false });
  });

  it("the schema is versioned by its migrations", () => {
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
    expect(Object.values(TABLES).length).toBeGreaterThan(0);
  });
});

describe("theme", () => {
  it("exposes the profile palette and fonts", () => {
    expect(PROFILE.ink).toMatch(/^#/);
    expect(PROFILE_PASTELS.mint).toMatch(/^#/);
    expect(profileFonts.display).toBeTruthy();
  });
});

describe("frame probe", () => {
  let now = 0;
  let queued: (() => void)[] = [];
  beforeEach(() => {
    now = 0;
    queued = [];
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => queued.push(fn));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const drain = async () => {
    let frame = 0;
    while (queued.length) {
      // Every third frame is slow enough to count as a stall.
      now += ++frame % 3 === 0 ? 45 : 16;
      queued.shift()!();
    }
    await Promise.resolve();
    await Promise.resolve();
  };

  it("records frames and marks, and reports them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    mark("ignored while idle");
    startFrameProbe("scroll", 50);
    startFrameProbe("second call is ignored");
    mark("halfway");
    await drain();
    expect(fetchMock).toHaveBeenCalledOnce();
    const report = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(report.label).toBe("scroll");
    expect(report.marks.map((m: { name: string }) => m.name)).toEqual(["halfway"]);
    expect(report.droppedFrames).toBeGreaterThanOrEqual(0);
  });

  it("shrugs off an unreachable collector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    startFrameProbe("idle", 10);
    await drain();
    expect(console.log).toHaveBeenCalledWith("[frame-probe] collector unreachable", "Error: offline");
  });
});
