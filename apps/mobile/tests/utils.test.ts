import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "@/utils/debounce";
import { deckCardColors } from "@/utils/deck-colors";
import { formatRenewal } from "@/utils/format-renewal";
import { getCardTitleMargin } from "@/utils/getCardTitleMargin";
import {
  getRandomIntExclusive,
  getRandomIntInclusive,
} from "@/utils/getRandomNumber";
import {
  collapseWhitespace,
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "@/utils/nickname";
import { parseBlocks, parseInlineMarkdown } from "@/utils/parseInlineMarkdown";

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once on the trailing edge with the last arguments", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it("fires on the leading edge and not again for a single call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { leading: true });
    d("a");
    expect(fn).toHaveBeenCalledWith("a");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("with leading, a burst still ends on the trailing edge", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { leading: true });
    d("a");
    d("b");
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("can skip the trailing edge", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { trailing: false });
    d("a");
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel drops the pending call, and is safe when idle", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.cancel();
    d(1);
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush runs the pending call now, and is a no-op when idle", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
    d(7);
    d.flush();
    expect(fn).toHaveBeenCalledWith(7);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("deckCardColors", () => {
  it("derives three hex tones from the base", () => {
    const tones = deckCardColors("#F4D35E");
    for (const tone of Object.values(tones)) {
      expect(tone).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(tones.title).not.toBe(tones.pill);
  });
});

describe("formatRenewal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 9, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("says today with the time for a same-day end", () => {
    expect(formatRenewal(new Date(2026, 8, 25, 18, 30).toISOString())).toMatch(
      /^today /,
    );
  });

  it("says tomorrow with the time for a next-day end", () => {
    expect(formatRenewal(new Date(2026, 8, 26, 8, 0).toISOString())).toMatch(
      /^tomorrow /,
    );
  });

  it("gives a date further out, optionally with the year", () => {
    const iso = new Date(2026, 9, 21, 8, 0).toISOString();
    expect(formatRenewal(iso)).not.toMatch(/today|tomorrow/);
    expect(formatRenewal(iso, true)).toContain("2026");
  });
});

describe("getCardTitleMargin", () => {
  it("scales with length and caps at 150", () => {
    expect(getCardTitleMargin(10)).toBe(20);
    expect(getCardTitleMargin(10, undefined, 3)).toBe(30);
    expect(getCardTitleMargin(500)).toBe(150);
  });
});

describe("random integers", () => {
  it("stay inside their bounds", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0);
    expect(getRandomIntExclusive(3, 7)).toBe(3);
    expect(getRandomIntInclusive(3, 7)).toBe(3);
    random.mockReturnValue(0.9999);
    expect(getRandomIntExclusive(3, 7)).toBe(6);
    expect(getRandomIntInclusive(3, 7)).toBe(7);
  });
});

describe("nickname rules", () => {
  it("collapses and normalises whitespace and case", () => {
    expect(collapseWhitespace("  Sam   the  Man ")).toBe("Sam the Man");
    expect(normalizeNickname("  SAM  Lee ")).toBe("sam lee");
  });

  it("accepts a good nickname", () => {
    expect(validateNickname("  Div  P. ")).toEqual({
      valid: true,
      display: "Div P.",
      normalized: "div p.",
    });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["a", "too_short"],
    ["x".repeat(NICKNAME_MAX_LENGTH + 1), "too_long"],
    ["hi!", "invalid_chars"],
    ["--", "invalid_chars"],
  ])("rejects %j as %s", (raw, code) => {
    const result = validateNickname(raw);
    expect(result.valid).toBe(false);
    expect(result.code).toBe(code);
    expect(result.message).toBeTruthy();
  });
});

describe("parseInlineMarkdown", () => {
  it("splits bold, italic and plain runs", () => {
    expect(parseInlineMarkdown("a **b** *c* d")).toEqual([
      { text: "a ", bold: false, italic: false },
      { text: "b", bold: true, italic: false },
      { text: " ", bold: false, italic: false },
      { text: "c", bold: false, italic: true },
      { text: " d", bold: false, italic: false },
    ]);
  });

  it("skips a stray asterisk", () => {
    expect(parseInlineMarkdown("*")).toEqual([]);
  });
});

describe("parseBlocks", () => {
  it("reads headings, beat labels, quotes and paragraphs", () => {
    const blocks = parseBlocks(
      [
        "## [HOOK] · ~25s",
        "First line",
        "continues here.",
        "",
        "> *(pause)*",
        "> still quoted",
        "### Plain heading ##",
        "Last **bold** para",
      ].join("\n"),
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "quote",
      "heading",
      "paragraph",
    ]);
    expect(blocks[0]).toMatchObject({ level: 2, label: "HOOK" });
    expect(blocks[1]).toMatchObject({
      segments: [{ text: "First line continues here." }],
    });
    expect(blocks[2]).toMatchObject({ type: "quote" });
    expect((blocks[2] as { lines: unknown[] }).lines).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ level: 3, label: null });
  });

  it("treats an empty heading as a paragraph line", () => {
    expect(parseBlocks("##   ")).toEqual([
      { type: "paragraph", segments: [{ text: "##", bold: false, italic: false }] },
    ]);
  });

  it("returns nothing for blank input", () => {
    expect(parseBlocks("\n\n")).toEqual([]);
  });
});
