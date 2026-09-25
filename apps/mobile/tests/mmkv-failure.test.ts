import { describe, expect, it, vi } from "vitest";

// Its own file: this replaces the in-memory MMKV from tests/setup.ts with one
// whose writes all fail, which no other test should ever see.
vi.mock("react-native-mmkv", () => ({
  createMMKV: () => ({
    getString: () => "{}",
    set: () => {
      throw new Error("disk full");
    },
    remove: () => {
      throw new Error("locked");
    },
    clearAll: () => {
      throw new Error("locked");
    },
  }),
}));

import { createMMKVStorage } from "@/store/mmkv.storage";

describe("mmkv storage adapter on a failing native store", () => {
  it("logs each failure and carries on", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = createMMKVStorage("broken");
    storage.setItem("k", "v");
    storage.removeItem("k");
    storage.clearAll();
    expect(storage.getItem("k")).toBe("{}");
    expect(error).toHaveBeenCalledTimes(3);
  });
});
