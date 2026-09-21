import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import GlassAvatar from "@/components/ui/glass-avatar";
import PressableScale from "@/components/ui/animated/PressableScale";
import { useProfileIdentity } from "@/hooks/use-profile-identity";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import {
  PROFILE,
  PROFILE_PASTELS,
  profileFonts,
} from "@/screens/profile/theme";

const AVATAR_SIZE = 84;

/**
 * The avatar row for Edit Profile.
 *
 * Native `Form` can't render the Blobatar's SVG, so this is a React Native row
 * sitting above the SwiftUI form rather than a `Section` inside it. It shares
 * the exact same ProfileAvatar + Clerk upload path as the profile wizard, so
 * adding, changing or removing a photo updates the Profile screen immediately.
 */
const ProfilePhotoSection = () => {
  const { name, imageUrl, isLoaded } = useProfileIdentity();
  const {
    pendingAsset,
    pickImage,
    uploadAsset,
    removePhoto,
    isPicking,
    isUploading,
    error,
  } = useProfilePhoto();

  const busy = isPicking || isUploading;
  const hasImage = imageUrl != null;
  const previewUrl = pendingAsset?.uri ?? imageUrl;

  const handleChange = async () => {
    const asset = await pickImage();
    if (asset) await uploadAsset(asset);
  };

  const handleRemove = async () => {
    await removePhoto();
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <GlassAvatar
          imageUrl={previewUrl}
          name={name}
          size={AVATAR_SIZE}
          loading={!isLoaded}
          tint={PROFILE_PASTELS.pink}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.caption}>
          {hasImage ? "Your profile photo" : "Sailor's generated avatar"}
        </Text>

        <View style={styles.actions}>
          <PressableScale
            onPress={handleChange}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={hasImage ? "Change photo" : "Add photo"}
            style={styles.action}
          >
            {busy && !hasImage ? (
              <ActivityIndicator size="small" color={PROFILE.ink} />
            ) : (
              <Text style={styles.actionText}>
                {hasImage ? "Change photo" : "Add photo"}
              </Text>
            )}
          </PressableScale>

          {hasImage ? (
            <PressableScale
              onPress={handleRemove}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              style={styles.action}
            >
              <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
            </PressableScale>
          ) : null}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default ProfilePhotoSection;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 56,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: PROFILE.background,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
  },
  info: {
    flex: 1,
    gap: 8,
  },
  caption: {
    fontFamily: profileFonts.medium,
    fontSize: 14,
    color: PROFILE.muted,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  action: {
    minHeight: 32,
    justifyContent: "center",
  },
  actionText: {
    fontFamily: profileFonts.semibold,
    fontSize: 15,
    color: PROFILE.ink,
    letterSpacing: -0.2,
  },
  removeText: {
    color: "#D6455D",
  },
  error: {
    fontFamily: profileFonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: "#C0392B",
  },
});
