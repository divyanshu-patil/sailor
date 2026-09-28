import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";

import PressableScale from "@/components/ui/animated/PressableScale";

import GlassAvatar from "@/components/ui/glass-avatar";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "../theme";

const AVATAR_SIZE = 132;

interface ProfileHeroProps {
  name: string;
  email: string;
  /** Seed for the Blobatar — the nickname. Defaults to `name`. */
  avatarName?: string;
  /** Holds off the avatar until the identity is available. */
  avatarLoading?: boolean;
  /** Tapping the photo opens Edit Profile — the same affordance as the row
   *  below it, because the picture is the thing people reach for. */
  onAvatarPress?: () => void;
}

/**
 * The identity block: the large pastel avatar (the nickname's Blobatar), the
 * nickname and email. Purely presentational — the screen owns the data.
 */
const ProfileHero = memo(function ProfileHero({
  name,
  email,
  avatarName,
  avatarLoading,
  onAvatarPress,
}: ProfileHeroProps) {
  // Alive while the profile is in view; still when it's behind another screen
  // or the user has asked for less motion.
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const animate = focused && !reduceMotion;

  return (
    <View style={styles.container}>
      <PressableScale
        style={styles.avatarWrap}
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Edit your profile"
      >
        <GlassAvatar
          name={avatarName ?? name}
          size={AVATAR_SIZE}
          loading={avatarLoading}
          animate={animate}
          tint={PROFILE_PASTELS.pink}
        />
      </PressableScale>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {email ? (
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
      ) : null}
    </View>
  );
});

export default ProfileHero;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  name: {
    marginTop: 18,
    fontFamily: profileFonts.display,
    fontSize: 26,
    color: PROFILE.ink,
    letterSpacing: -0.4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  email: {
    marginTop: 4,
    fontFamily: profileFonts.body,
    fontSize: 15,
    color: PROFILE.muted,
    textAlign: "center",
  },
});
