import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useNativeState } from "@expo/ui/swift-ui";
import { AppUserProfile, useAppUserStore } from "@/store/app-user.store";
import { usePreferenceStore } from "@/hooks";
import { colord } from "colord";

// TODO: swap for the real Clerk hook once it's wired in, e.g.:
//   const { user } = useUser();
//   const googleAccount = user?.externalAccounts.find(a => a.provider === "oauth_google");
//   const isEmailGoogleLinked = !!googleAccount;

interface ExternalLink {
  isExternalLinked: boolean;
  provider: "Google" | "Apple";
}

function useClerkExternalLink(): ExternalLink {
  return { isExternalLinked: true, provider: "Google" };
}

export function useEditProfileForm(appUser: AppUserProfile) {
  const router = useRouter();
  const updateAppUserProfile = useAppUserStore((s) => s.updateAppUserProfile);
  const externalLinked = useClerkExternalLink();

  const [isSaving, setIsSaving] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorVisible(true);
  }, []);

  const nicknameState = useNativeState(appUser.nickname);

  const [nicknameValue, setNicknameValue] = useState(appUser.nickname);

  const handleNicknameChange = useCallback((text: string) => {
    setNicknameValue(text);
  }, []);

  const hasChanges = useMemo(() => {
    return nicknameValue.trim() !== appUser.nickname;
  }, [appUser, nicknameValue]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateAppUserProfile({ nickname: nicknameValue.trim() });
      router.back();
    } catch {
      showError("Something went wrong saving your profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [nicknameValue, updateAppUserProfile, router, showError]);

  const { hex } = usePreferenceStore((state) => state.preferences.appearance);
  const appearanceColor = useMemo(
    () => colord(hex).darken(0.15).desaturate(0.35).toHex(),
    [hex],
  );

  return {
    router,
    isSaving,
    externalLinked,
    email: appUser.email,
    nicknameState,
    handleNicknameChange,
    hasChanges,
    handleSave,
    errorVisible,
    setErrorVisible,
    errorMessage,
    appearanceColor,
  };
}
