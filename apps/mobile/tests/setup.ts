import { vi } from "vitest";

// React Native's build-time flag. True, as in a dev build; tests that need the
// release path set it to false and re-import.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

// lib/config/env throws at import without these — the app gets them from
// .env via Expo; tests get stand-ins.
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??= "pk_test_vitest";
process.env.EXPO_PUBLIC_API_URL ??= "http://api.test";

/**
 * react-native-mmkv, in memory. One map per instance id, like the real thing,
 * so stores persisting under different ids don't see each other.
 */
vi.mock("react-native-mmkv", () => {
  const instances = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const data = instances.get(id) ?? new Map<string, string>();
      instances.set(id, data);
      return {
        getString: (key: string) => data.get(key),
        set: (key: string, value: string | number | boolean) =>
          data.set(key, String(value)),
        remove: (key: string) => data.delete(key),
        contains: (key: string) => data.has(key),
        getAllKeys: () => [...data.keys()],
        clearAll: () => data.clear(),
      };
    },
  };
});

/** Just enough of react-native for the logic layer's few imports of it. */
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (spec: Record<string, unknown>) => spec.ios ?? spec.default,
  },
  useColorScheme: () => "light",
}));
