import { memo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { AnimatedBlobatar } from "@blobatar/react-native/animated";

export interface ProfileAvatarProps {
  /**
   * The real profile image — Clerk's `user.imageUrl` when the user has one.
   * `null`/undefined falls back to a generated Blobatar.
   */
  imageUrl?: string | null;
  /**
   * Seed for the generated avatar, and the source of the accessible label.
   * Use the user's name (or the app's next-best identity) so the same person
   * always gets the same face.
   */
  name?: string | null;
  /** Side length in points. */
  size: number;
  /** Circle colour shown behind the image/Blobatar. */
  backgroundColor?: string;
  /**
   * True while the identity is still loading. Renders a plain circle instead of
   * a Blobatar so a temporarily-empty name can't produce the wrong face.
   */
  loading?: boolean;
  /**
   * Run the Blobatar's idle layer — breathing, a bob, blinks and a glance to
   * either side, on the UI thread. Off by default: most avatars sit in lists,
   * and the caller is the one who knows when it is on screen.
   */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Overrides the generated "{name}'s profile picture" label. */
  accessibilityLabel?: string;
}

const DEFAULT_BACKGROUND = "#F6C9D8";

/**
 * The single avatar abstraction for the whole app.
 *
 * Real image when one exists, otherwise a deterministic Blobatar derived from
 * `name` — never a persisted file, never a network request. One component so no
 * screen has to re-implement the `imageUrl ? ... : ...` branch, and every
 * surface stays in sync the moment Clerk's user updates.
 */
const ProfileAvatar = memo(function ProfileAvatar({
  imageUrl,
  name,
  size,
  backgroundColor = DEFAULT_BACKGROUND,
  loading = false,
  animate = false,
  style,
  accessibilityLabel,
}: ProfileAvatarProps) {
  const hasImage = !!imageUrl;
  const hasSeed = !!name && name.trim().length > 0;
  const label =
    accessibilityLabel ??
    (hasSeed ? `${name}'s profile picture` : "Profile picture");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      {hasImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.fill}
          contentFit="cover"
          transition={200}
        />
      ) : !loading && hasSeed ? (
        // No `title`: the parent owns the accessible label, so the SVG stays
        // hidden from screen readers and the avatar is announced exactly once.
        <AnimatedBlobatar name={name} size={size} animate={animate} />
      ) : null}
    </View>
  );
});

export default ProfileAvatar;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
