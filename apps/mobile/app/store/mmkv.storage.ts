import { createMMKV } from "react-native-mmkv";

export function createMMKVStorage(id: string) {
  const mmkv = createMMKV({ id });

  return {
    getItem: (name: string): string | null => {
      try {
        const value = mmkv.getString(name);
        if (!value) return null;
        // sanity-check it's parseable before handing to zustand
        JSON.parse(value);
        return value;
      } catch (e) {
        console.error(
          `MMKV[${id}] getItem parse error, clearing corrupted key:`,
          e,
        );
        mmkv.remove(name);
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        mmkv.set(name, value);
      } catch (e) {
        console.error(`MMKV[${id}] setItem error:`, e);
      }
    },
    removeItem: (name: string): void => {
      try {
        mmkv.remove(name);
      } catch (e) {
        console.error(`MMKV[${id}] removeItem error:`, e);
      }
    },
    /** Wipes only this instance's keys. Used by the dev storage reset. */
    clearAll: (): void => {
      try {
        mmkv.clearAll();
      } catch (e) {
        console.error(`MMKV[${id}] clearAll error:`, e);
      }
    },
  };
}
