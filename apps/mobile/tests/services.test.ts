import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import { appearanceService } from "@/services/appearance.service";
import {
  attachmentService,
  checkSize,
  formatBytes,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_BYTES,
  maxBytesForKind,
} from "@/services/attachment.service";
import { audioService } from "@/services/audio.service";
import { cardService } from "@/services/card.service";
import { dailyPracticeService } from "@/services/daily-practice.service";
import { deckService } from "@/services/deck.service";
import { onboardingDemoService } from "@/services/onboarding-demo.service";
import { onboardingService } from "@/services/onboarding.service";
import { preferencesService } from "@/services/preferences.service";
import { publicDeckService } from "@/services/public-deck.service";
import { scriptService } from "@/services/script.service";
import { MAX_LENGTH, truncateField, userService } from "@/services/user.service";
import type { OnboardingState } from "@/types/onboarding";

const api = vi.mocked(apiClient);
const ok = <T>(data: T) => Promise.resolve({ data }) as never;
const fail = (status = 500, detail?: unknown) =>
  Promise.reject(
    Object.assign(new Error("boom"), {
      response: { status, data: detail === undefined ? {} : { detail } },
    }),
  ) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/**
 * Most service methods are the same shape — call, map, and on failure log and
 * rethrow. This runs one through both halves.
 */
async function passesThrough<T>(
  method: "get" | "post" | "patch" | "put" | "delete",
  call: () => Promise<T>,
  data: unknown,
) {
  api[method].mockImplementationOnce(() => ok(data));
  const result = await call();
  api[method].mockImplementationOnce(() => fail());
  await expect(call()).rejects.toThrow("boom");
  return result;
}

describe("appearance / preferences / user", () => {
  it("appearance options", async () => {
    expect(
      await passesThrough("get", () => appearanceService.getOptions(), [{ id: "a" }]),
    ).toEqual([{ id: "a" }]);
  });

  it("preferences get, create, update", async () => {
    await passesThrough("get", () => preferencesService.getPreferences(), { a: 1 });
    await passesThrough("post", () => preferencesService.createPreferences({} as never), {});
    await passesThrough("patch", () => preferencesService.updatePreferences({}), {});
    expect(api.patch).toHaveBeenCalledWith("/api/v1/users/preferences", {});
  });

  it("profile is truncated to the field limits", async () => {
    const profile = await passesThrough("get", () => userService.getProfile(), {
      nickname: "n".repeat(50),
    });
    expect(profile.nickname).toHaveLength(MAX_LENGTH.nickname);
    expect(truncateField(undefined, 3)).toBe("");
    expect(truncateField("abcdef", 3)).toBe("abc");
  });

  it("profile update and delete", async () => {
    await passesThrough("patch", () => userService.updateProfile({ nickname: "x" }), {});
    await passesThrough("delete", () => userService.deleteAccount(), undefined);
  });
});

describe("attachments", () => {
  it("limits per kind and overall", () => {
    expect(maxBytesForKind("image")).toBe(MAX_IMAGE_BYTES);
    expect(maxBytesForKind("document")).toBe(MAX_DOCUMENT_BYTES);
    expect(checkSize("image", undefined, 0)).toBeNull();
    expect(checkSize("image", MAX_IMAGE_BYTES + 1, 0)).toMatch(/limit/);
    expect(checkSize("document", 1024, MAX_TOTAL_BYTES)).toMatch(/Remove one/);
    expect(checkSize("document", 1024, 0)).toBeNull();
  });

  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(5 * 1024 ** 5)).toMatch(/GB$/);
  });

  it("uploads as multipart and reports progress", async () => {
    api.post.mockImplementationOnce(((_url: string, _body: unknown, config: any) => {
      expect(config.transformRequest("x")).toBe("x");
      config.onUploadProgress({ loaded: 5, total: 10 });
      config.onUploadProgress({ loaded: 5 });
      return ok({
        id: 1,
        kind: "image",
        filename: "f.png",
        content_type: "image/png",
        size_bytes: 10,
        url: null,
        has_text: false,
        created_at: "",
      });
    }) as never);
    const progress = vi.fn();
    const uploaded = await attachmentService.upload(
      { uri: "file://f", name: "f.png", type: "image/png" },
      progress,
    );
    expect(progress).toHaveBeenCalledWith(0.5);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(uploaded).toMatchObject({ id: 1, contentType: "image/png", hasText: false });
  });

  it("upload without a progress callback", async () => {
    api.post.mockImplementationOnce(((_u: string, _b: unknown, config: any) => {
      config.onUploadProgress({ loaded: 1, total: 2 });
      return ok({ id: 2, kind: "document" });
    }) as never);
    await expect(
      attachmentService.upload({ uri: "u", name: "n", type: "t" }),
    ).resolves.toMatchObject({ id: 2 });
  });

  it("remove swallows failures", async () => {
    api.delete.mockImplementationOnce(() => ok(undefined));
    await attachmentService.remove(1);
    api.delete.mockImplementationOnce(() => fail());
    await expect(attachmentService.remove(1)).resolves.toBeUndefined();
    api.delete.mockImplementationOnce(() => Promise.reject(undefined) as never);
    await expect(attachmentService.remove(1)).resolves.toBeUndefined();
  });
});

describe("audio", () => {
  it("upload, playback url, delete", async () => {
    await passesThrough("post", () => audioService.uploadRecording("1", "file://a"), {});
    await passesThrough("get", () => audioService.getPlaybackUrl("1"), {});
    await passesThrough("delete", () => audioService.deleteRecording("1"), {});
  });
});

describe("cards", () => {
  it("get, list, status, regenerate, cancel", async () => {
    await passesThrough("get", () => cardService.getCards("1"), []);
    await passesThrough("get", () => cardService.getCard("1", "2"), {});
    await passesThrough("get", () => cardService.getJobStatus("1"), {});
    expect(
      await passesThrough("post", () => cardService.regenerate("1"), {
        cards_generation_status: "pending",
      }),
    ).toBe("pending");
    await passesThrough("post", () => cardService.cancelJob("1"), undefined);
  });

  it("update: ok, conflict with and without a reload, error", async () => {
    api.patch.mockImplementationOnce(() => ok({ id: 1 }));
    expect(await cardService.updateCard("1", "2", 3, { title: "t" })).toEqual({
      status: "ok",
      card: { id: 1 },
    });

    api.patch.mockImplementationOnce(() => fail(409, "changed"));
    api.get.mockImplementationOnce(() => ok({ id: 1, version: 4 }));
    expect(await cardService.updateCard("1", "2", 3, {})).toEqual({
      status: "conflict",
      card: { id: 1, version: 4 },
      message: "changed",
    });

    api.patch.mockImplementationOnce(() => fail(409));
    api.get.mockImplementationOnce(() => fail());
    expect(await cardService.updateCard("1", "2", 3, {})).toMatchObject({
      status: "conflict",
      card: null,
      message: expect.stringMatching(/changed somewhere else/),
    });

    api.patch.mockImplementationOnce(() => fail(500, "nope"));
    expect(await cardService.updateCard("1", "2", 3, {})).toEqual({
      status: "error",
      message: "nope",
    });

    api.patch.mockImplementationOnce(() => fail(500));
    expect(await cardService.updateCard("1", "2", 3, {})).toEqual({
      status: "error",
      message: "boom",
    });

    api.patch.mockImplementationOnce(() => Promise.reject({}) as never);
    expect(await cardService.updateCard("1", "2", 3, {})).toEqual({
      status: "error",
      message: "Couldn't save this card",
    });
  });
});

describe("daily practice", () => {
  it("today, complete, streak", async () => {
    await passesThrough("get", () => dailyPracticeService.getToday("2026-09-25"), {});
    await passesThrough("post", () => dailyPracticeService.markComplete(), {});
    await passesThrough("get", () => dailyPracticeService.getStreak(), {});
    // Defaults to the local date.
    await passesThrough("get", () => dailyPracticeService.getToday(), {});
  });

  it("restore is single-flight and clears after failure", async () => {
    let resolve!: (v: unknown) => void;
    api.post.mockImplementationOnce(
      () => new Promise((r) => (resolve = r)) as never,
    );
    const a = dailyPracticeService.restoreStreak("2026-09-25");
    const b = dailyPracticeService.restoreStreak("2026-09-25");
    expect(a).toBe(b);
    resolve({ data: { currentStreak: 3 } });
    expect(await a).toEqual({ currentStreak: 3 });

    api.post.mockImplementationOnce(() => fail());
    await expect(dailyPracticeService.restoreStreak()).rejects.toThrow("boom");
    api.post.mockImplementationOnce(() => ok({ currentStreak: 1 }));
    await expect(dailyPracticeService.restoreStreak()).resolves.toEqual({
      currentStreak: 1,
    });
  });
});

describe("decks", () => {
  const detail = {
    id: 7,
    user_id: 1,
    title: null,
    description: null,
    script: "s",
    color: "#fff",
    duration_mins: 3,
    card_count: 6,
    is_favorite: false,
    is_public: false,
    tags: null,
    category: null,
    practice_count: null,
    save_count: null,
    published_at: null,
    generation_status: "completed",
    generation_error: null,
    created_at: "c",
    updated_at: "u",
  };

  it("maps the grid summary", async () => {
    const decks = await passesThrough("get", () => deckService.getDecks(), [
      {
        id: 1,
        title: null,
        description: "d",
        color: "#000",
        updatedAt: "u",
        slideCount: 2,
        durationMins: 3,
        isFavourite: true,
      },
    ]);
    expect(decks[0]).toMatchObject({ id: "1", title: "", slideCount: 2 });
  });

  it("maps the detail, and the deck from it", async () => {
    const result = await passesThrough("get", () => deckService.getDeckDetail("7"), detail);
    expect(result.deck).toMatchObject({
      id: "7",
      title: "",
      description: "",
      slideCount: 6,
      tags: [],
      practiceCount: 0,
      saveCount: 0,
    });
    expect(result.script).toBe("s");
    api.get.mockImplementationOnce(() => ok({ ...detail, tags: ["x"], practice_count: 2, save_count: 3 }));
    expect(await deckService.getDeck("7")).toMatchObject({ tags: ["x"], practiceCount: 2, saveCount: 3 });
  });

  it("refuses to create directly", async () => {
    await expect(deckService.createDeck({} as never)).rejects.toThrow(/accepting a script/);
  });

  it("update, publish, unpublish, delete", async () => {
    await passesThrough("patch", () => deckService.updateDeck("7", {}), detail);
    await passesThrough("post", () => deckService.publish("7", {} as never), detail);
    await passesThrough("post", () => deckService.unpublish("7"), detail);
    await passesThrough("delete", () => deckService.deleteDeck("7"), undefined);
  });

  it("toggles the favourite flag", async () => {
    api.get.mockImplementationOnce(() => ok({ ...detail, is_favorite: true }));
    api.patch.mockImplementationOnce(() => ok({ ...detail, is_favorite: false }));
    expect((await deckService.toggleFavourite("7")).isFavourite).toBe(false);
    expect(api.patch).toHaveBeenCalledWith("/api/v1/decks/7", { isFavourite: false });
  });
});

describe("public decks", () => {
  const raw = {
    id: 3,
    title: null,
    description: null,
    color: "#fff",
    audience: "general",
    durationMins: 2,
    slideCount: 4,
    tags: null,
    category: null,
    practiceCount: null,
    publishedAt: null,
    creator: { id: 1, name: "c" },
  };

  it("lists with cleaned params", async () => {
    const page = await passesThrough(
      "get",
      () =>
        publicDeckService.list({ q: "  hi ", cursor: "", category: null, tag: "t", sort: "recent", limit: 5 }),
      { items: [raw], nextCursor: null, hasMore: false },
    );
    expect(page.items[0]).toMatchObject({ id: "3", title: "Untitled", tags: [], practiceCount: 0, saveCount: 0 });
    expect(api.get.mock.calls[0][1]).toEqual({
      params: { cursor: undefined, limit: 5, q: "hi", category: undefined, tag: "t", sort: "recent" },
    });
    api.get.mockImplementationOnce(() => ok({ items: [], nextCursor: null, hasMore: false }));
    await publicDeckService.list();
  });

  it("detail, saved list, save toggles, practice", async () => {
    const detail = await passesThrough("get", () => publicDeckService.get("3"), raw);
    expect(detail).toMatchObject({ script: "", isSaved: false });
    api.get.mockImplementationOnce(() => ok({ ...raw, title: "T", script: "s", isSaved: true, saveCount: 9, practiceCount: 1, tags: ["a"] }));
    expect(await publicDeckService.get("3")).toMatchObject({ title: "T", script: "s", isSaved: true, saveCount: 9 });

    await passesThrough("get", () => publicDeckService.listSaved(), [raw]);
    await passesThrough("post", () => publicDeckService.setSaved("3", true), undefined);
    await passesThrough("delete", () => publicDeckService.setSaved("3", false), undefined);

    api.post.mockImplementationOnce(() => ok(undefined));
    await publicDeckService.recordPractice("3");
    api.post.mockImplementationOnce(() => fail());
    await expect(publicDeckService.recordPractice("3")).resolves.toBeUndefined();
  });
});

describe("scripts", () => {
  const generation = {
    id: 5,
    description: "d",
    duration_mins: 3,
    card_count: 6,
    audience: "general",
    title: null,
    script: null,
    status: "completed",
    error: null,
    deck_id: null,
    version_count: 1,
    created_at: "c",
    updated_at: "u",
  };

  it("generates with the mapped audience, attachments and links", async () => {
    const result = await passesThrough(
      "post",
      () =>
        scriptService.generate({
          attachments: [
            { id: "a", kind: "image", name: "i", remoteId: 11 } as never,
            { id: "b", kind: "link", name: " https://x.y " } as never,
            { id: "c", kind: "link", name: "  " } as never,
          ],
          description: "desc",
          durationMinutes: 3,
          audienceIndex: 1,
          cardCount: 6,
          mood: "calm",
          profession: null,
          experienceLevel: "intermediate",
        }),
      { generation: { ...generation, deck_id: 9 }, reused: true },
    );
    expect(result.reused).toBe(true);
    expect(result.generation).toMatchObject({ id: "5", title: "", script: "", deckId: "9" });
    expect(api.post.mock.calls[0][1]).toMatchObject({
      audience: "executives",
      attachmentIds: [11],
      links: ["https://x.y"],
      profession: undefined,
    });
  });

  it("falls back to a general audience and no attachments", async () => {
    api.post.mockImplementationOnce(() => ok({ generation, reused: false }));
    await scriptService.generate({
      attachments: undefined as never,
      description: "d",
      durationMinutes: 1,
      audienceIndex: 99,
      cardCount: 1,
      mood: "calm",
      profession: "tech",
      experienceLevel: "beginner",
    });
    expect(api.post.mock.calls[0][1]).toMatchObject({
      audience: "general",
      attachmentIds: [],
      links: [],
      profession: "tech",
    });
  });

  it("status maps nulls away", async () => {
    const status = await passesThrough("get", () => scriptService.getJobStatus("5"), {
      status: "processing",
      title: null,
      script: null,
    });
    expect(status).toEqual({
      status: "processing",
      error: undefined,
      title: undefined,
      script: undefined,
      attempt: undefined,
    });
    api.get.mockImplementationOnce(() => ok({ status: "completed", title: "T", script: "S", attempt: 2 }));
    expect(await scriptService.getJobStatus("5")).toMatchObject({ title: "T", script: "S", attempt: 2 });
  });

  it("get, drafts, revise, edit, retry, restore", async () => {
    await passesThrough("get", () => scriptService.get("5"), { ...generation, title: "T", script: "S" });
    const drafts = await passesThrough("get", () => scriptService.listDrafts(), [
      generation,
      { ...generation, title: "T", deck_id: 2 },
    ]);
    expect(drafts.map((d) => d.deckId)).toEqual([null, "2"]);
    await passesThrough("post", () => scriptService.revise("5", "shorter"), generation);
    await passesThrough("patch", () => scriptService.edit("5", "new"), generation);
    await passesThrough("post", () => scriptService.retry("5"), generation);
    await passesThrough("post", () => scriptService.restoreVersion("5", "1"), generation);
  });

  it("versions", async () => {
    const versions = await passesThrough("get", () => scriptService.listVersions("5"), [
      { id: 1, position: 1, title: "t", script: "s", kind: "generated", instruction: null, created_at: "c" },
    ]);
    expect(versions[0]).toMatchObject({ id: "1", createdAt: "c" });
  });

  it("cancel, deck build, discard", async () => {
    await passesThrough("post", () => scriptService.cancel("5"), undefined);
    const build = await passesThrough("post", () => scriptService.startDeckBuild("5"), {
      status: "pending",
      deck_id: null,
      error: null,
    });
    expect(build).toEqual({ status: "pending", deckId: null, error: undefined });
    expect(
      await passesThrough("get", () => scriptService.getDeckBuildStatus("5"), {
        status: "completed",
        deck_id: 4,
        error: "e",
      }),
    ).toEqual({ status: "completed", deckId: "4", error: "e" });
    await passesThrough("post", () => scriptService.cancelDeckBuild("5"), undefined);
    await passesThrough("delete", () => scriptService.discard("5"), undefined);
  });
});

describe("onboarding progress", () => {
  const server = {
    flow_version: "2026-09",
    status: "in_progress",
    current_step_id: "gender",
    completed_steps: ["profile_identity"],
    data: { nickname: "Div" },
    completed_at: null,
    updated_at: "2026-09-25T00:00:00.000Z",
  };

  it("reads a stored position, and none for a never-written one", async () => {
    api.get.mockImplementationOnce(() => ok(server));
    expect(await onboardingService.getProgress("u1")).toMatchObject({
      userId: "u1",
      currentStepId: "gender",
      completedSteps: ["profile_identity"],
      lastUpdatedAt: server.updated_at,
    });
    api.get.mockImplementationOnce(() => ok({ ...server, updated_at: null }));
    expect(await onboardingService.getProgress("u1")).toBeNull();
  });

  it("saves the full state and maps the answer", async () => {
    api.put.mockImplementationOnce(() =>
      ok({ ...server, current_step_id: null, completed_steps: null, data: null, updated_at: null }),
    );
    const state = {
      userId: "u1",
      flowVersion: "2026-09",
      status: "completed",
      currentStepId: null,
      completedSteps: [],
      data: {},
      completedAt: "x",
      lastUpdatedAt: "y",
    } as OnboardingState;
    const saved = await onboardingService.saveProgress(state);
    expect(saved).toMatchObject({ currentStepId: null, completedSteps: [], data: {} });
    expect(saved.lastUpdatedAt).toBeTruthy();
    expect(api.put.mock.calls[0][1]).toMatchObject({ status: "completed", completed_at: "x" });
  });

  it("claims the nickname and marks completion through the profile", async () => {
    api.patch.mockImplementation(() => ok({}));
    await onboardingService.claimNickname("Div");
    await onboardingService.markOnboardingComplete();
    expect(api.patch.mock.calls.map((c) => c[1])).toEqual([
      { nickname: "Div" },
      { onboarding_completed: true },
    ]);
  });
});

describe("onboarding demos", () => {
  beforeEach(() => onboardingDemoService.clearCache());

  it("lists once per context set, and fetches a demo once", async () => {
    api.get.mockImplementation(() => ok([{ id: "a" }]));
    const first = await onboardingDemoService.listDemos(["work", "college"]);
    await onboardingDemoService.listDemos(["work", "college"]);
    expect(first).toEqual([{ id: "a" }]);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/api/v1/onboarding-demos", {
      params: { contexts: "work,college", limit: 4 },
    });

    api.get.mockImplementation(() => ok({ id: "work new" }));
    await onboardingDemoService.getDemo("work new");
    await onboardingDemoService.getDemo("work new");
    expect(api.get).toHaveBeenLastCalledWith("/api/v1/onboarding-demos/work%20new");
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("doesn't cache a failure", async () => {
    api.get.mockImplementationOnce(() => fail());
    await expect(onboardingDemoService.getDemo("x")).rejects.toThrow("boom");
    api.get.mockImplementationOnce(() => ok({ id: "x" }));
    await expect(onboardingDemoService.getDemo("x")).resolves.toEqual({ id: "x" });
  });
});
