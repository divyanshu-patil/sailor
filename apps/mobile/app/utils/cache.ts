import { createMMKV } from "react-native-mmkv";
import { usePreferenceStore } from "@/store/preference-store";

const mmkvIds = ["preference-storage", "script-store"];

export function getCacheSizeBytes(): number {
  return mmkvIds.reduce((total, id) => {
    const mmkv = createMMKV({ id });
    return total + mmkv.byteSize;
  }, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function clearAllCache() {
  mmkvIds.forEach((id) => {
    const mmkv = createMMKV({ id });
    mmkv.clearAll();
  });

  usePreferenceStore.getState().resetPreferences();
}
