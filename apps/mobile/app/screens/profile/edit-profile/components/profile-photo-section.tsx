import React from "react";
import { View } from "react-native";
import { LayoutAnimationConfig } from "react-native-reanimated";
import { RNHostView, Section, ZStack } from "@expo/ui/swift-ui";
import {
  frame,
  listRowBackground,
  padding,
} from "@expo/ui/swift-ui/modifiers";

import MorphingAvatar from "@/screens/onboarding/components/morphing-avatar";
import { PROFILE_PASTELS } from "@/screens/profile/theme";

const AVATAR_SIZE = 112;

/**
 * The avatar row for Edit Profile — a `Section` in the form, so it scrolls with
 * everything else, its row background cleared so the face sits on the page.
 *
 * The avatar is the Blobatar the nickname gave them in onboarding: the same
 * morphing face, following the nickname field as it's edited. There is nothing
 * to tap — a new nickname is how you get a new face.
 */
const ProfilePhotoSection = ({ nickname }: { nickname: string }) => (
  <Section modifiers={[listRowBackground("clear")]}>
    <ZStack
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "center" }),
        padding({ vertical: 14 }),
      ]}
    >
      <RNHostView matchContents>
        {/* The first face is simply there — only a change of nickname morphs.
            A layout entrance starting while the sheet presents can stall
            invisible. */}
        <LayoutAnimationConfig skipEntering>
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              backgroundColor: PROFILE_PASTELS.pink,
              overflow: "hidden",
            }}
          >
            <MorphingAvatar name={nickname} size={AVATAR_SIZE} />
          </View>
        </LayoutAnimationConfig>
      </RNHostView>
    </ZStack>
  </Section>
);

export default ProfilePhotoSection;
