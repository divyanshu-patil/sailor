import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProfileAvatar from "@/components/ui/profile-avatar";
import PressableScale from "@/components/ui/animated/PressableScale";
import { useProfileIdentity } from "@/hooks/use-profile-identity";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import {
  PROFILE,
  PROFILE_PASTELS,
  profileFonts,
} from "@/screens/profile/theme";

const AVATAR_SIZE = 160;

interface ProfilePictureStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * The wizard's first (and, today, only) step: give the user a face.
 *
 * The fallback Blobatar is shown immediately, so the circle is never empty and
 * it's obvious that's their current avatar. Picking an image previews it and
 * turns the primary action into a save; a cancelled picker changes nothing and
 * a failed upload keeps the preview so Retry and Skip both stay reachable.
 */
const ProfilePictureStep = ({
  onComplete,
  onSkip,
}: ProfilePictureStepProps) => {
  const insets = useSafeAreaInsets();
  const { name, isLoaded } = useProfileIdentity();
  const {
    pendingAsset,
    pickImage,
    uploadPending,
    isPicking,
    isUploading,
    error,
  } = useProfilePhoto();

  const hasPending = !!pendingAsset;
  const busy = isPicking || isUploading;

  const handlePrimary = async () => {
    if (hasPending) {
      const saved = await uploadPending();
      if (saved) onComplete();
      return;
    }
    await pickImage();
  };

  const primaryLabel = hasPending ? "Save photo" : "Add profile picture";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: Math.max(insets.bottom, 24) + 12,
          },
        ]}
      >
        <View style={styles.hero}>
          <ProfileAvatar
            imageUrl={pendingAsset?.uri ?? null}
            name={name}
            size={AVATAR_SIZE}
            loading={!isLoaded}
            backgroundColor={PROFILE_PASTELS.pink}
          />

          <Text style={styles.heading}>Make it yours</Text>
          <Text style={styles.subtitle}>
            Add a profile picture, or let Sailor create one for you.
          </Text>
        </View>

        <View style={styles.footer}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <PressableScale
            onPress={handlePrimary}
            disabled={busy}
            style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            {busy ? (
              <ActivityIndicator color={PROFILE.white} />
            ) : (
              <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            )}
          </PressableScale>

          <View style={styles.links}>
            {hasPending ? (
              <Text
                onPress={busy ? undefined : () => void pickImage()}
                accessibilityRole="button"
                accessibilityLabel="Choose a different photo"
                style={styles.link}
              >
                Change photo
              </Text>
            ) : null}

            <Text
              onPress={busy ? undefined : onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              style={styles.link}
            >
              Skip for now
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProfilePictureStep;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PROFILE.background,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    marginTop: 32,
    fontFamily: profileFonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: PROFILE.ink,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 300,
    fontFamily: profileFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: PROFILE.muted,
    textAlign: "center",
  },
  footer: {
    gap: 12,
  },
  error: {
    fontFamily: profileFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: "#C0392B",
    textAlign: "center",
  },
  primaryButton: {
    height: 52,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonBusy: {
    opacity: 0.7,
  },
  primaryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingTop: 4,
  },
  link: {
    fontFamily: profileFonts.medium,
    fontSize: 15,
    color: PROFILE.muted,
    paddingVertical: 6,
  },
});
