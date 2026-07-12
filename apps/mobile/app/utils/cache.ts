import { createMMKV } from "react-native-mmkv";
import { usePreferenceStore } from "@/store/preference-store";

const mmkvIds = ["preference-storage", "script-store"];

export function clearAllCache() {
  mmkvIds.forEach((id) => {
    const mmkv = createMMKV({ id });
    mmkv.clearAll();
  });

  usePreferenceStore.getState().resetPreferences();
}