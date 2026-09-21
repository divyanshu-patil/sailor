import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import GlassAvatar from "@/components/ui/glass-avatar";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "../theme";

const AVATAR_SIZE = 132;

interface ProfileHeroProps {
  name: string;
  email: string;
  /** Real image URL from Clerk, or null for the generated fallback. */
  avatarUrl: string | null;
  /** Deterministic seed for the fallback avatar. Defaults to `name`. */
  avatarName?: string;
  /** Holds off the fallback avatar until Clerk's identity is available. */
  avatarLoading?: boolean;
}

/**
 * The identity block: the large pastel avatar (real photo when Clerk has one,
 * a name-seeded Blobatar otherwise), the user's name and email. Purely
 * presentational — the screen owns the data.
 */
const ProfileHero = memo(function ProfileHero({
  name,
  email,
  avatarUrl,
  avatarName,
  avatarLoading,
}: ProfileHeroProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        <GlassAvatar
          imageUrl={avatarUrl}
          name={avatarName ?? name}
          size={AVATAR_SIZE}
          loading={avatarLoading}
          tint={PROFILE_PASTELS.pink}
        />
      </View>

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
