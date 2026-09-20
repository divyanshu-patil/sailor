import { Host, RNHostView } from "@expo/ui/swift-ui";
import { glassEffect } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import ProfileAvatar, { type ProfileAvatarProps } from "./profile-avatar";

type GlassAvatarProps = ProfileAvatarProps & { tint?: string };

/**
 * A profile picture with a SwiftUI liquid-glass circle behind it. Falls back to
 * the plain `ProfileAvatar` (its pastel background) where liquid glass isn't
 * available. The blob/photo is drawn by the RN avatar via `RNHostView`, so the
 * SVG Blobatar keeps working while the background comes from `@expo/ui`.
 */
export default function GlassAvatar({ tint, ...props }: GlassAvatarProps) {
  if (!isLiquidGlassAvailable()) return <ProfileAvatar {...props} />;

  return (
    <Host
      matchContents
      modifiers={[
        glassEffect({
          glass: { variant: "regular", tint },
          shape: "circle",
        }),
      ]}
    >
      <RNHostView matchContents>
        <ProfileAvatar {...props} backgroundColor="transparent" />
      </RNHostView>
    </Host>
  );
}
