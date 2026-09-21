import { StyleSheet, View } from "react-native";
import { Host } from "@expo/ui/swift-ui";
import { glassEffect } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import ProfileAvatar, { type ProfileAvatarProps } from "./profile-avatar";

type GlassAvatarProps = ProfileAvatarProps & { tint?: string };

/**
 * A profile picture with a SwiftUI liquid-glass circle behind it.
 *
 * The glass is a SIBLING behind the avatar, not a parent around it. It used to
 * wrap the React Native avatar in `RNHostView` — an RN view hosted inside
 * SwiftUI — and a hosted view inside a ScrollView does not keep step with the
 * scroll: the photo drifted out of position relative to the name under it, and
 * settled somewhere else when the scrolling stopped.
 *
 * Nothing needs RN content inside SwiftUI here. The Host draws a glass circle
 * and nothing else, the avatar sits on top as an ordinary RN view, and the pair
 * scroll together because they are both just views in the RN tree.
 *
 * Falls back to the plain `ProfileAvatar` (its own pastel background) where
 * liquid glass is unavailable.
 */
export default function GlassAvatar({ tint, ...props }: GlassAvatarProps) {
  if (!isLiquidGlassAvailable()) return <ProfileAvatar {...props} />;

  const { size } = props;

  return (
    <View style={{ width: size, height: size }}>
      <Host
        style={[StyleSheet.absoluteFill, styles.glass]}
        pointerEvents="none"
        modifiers={[
          glassEffect({
            glass: { variant: "regular", tint },
            shape: "circle",
          }),
        ]}
      >
        {/* Empty on purpose: the modifier IS the circle. Anything in here would
            be RN content hosted in SwiftUI again. */}
        <></>
      </Host>
      <ProfileAvatar {...props} backgroundColor="transparent" />
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: 9999, overflow: "hidden" },
});
