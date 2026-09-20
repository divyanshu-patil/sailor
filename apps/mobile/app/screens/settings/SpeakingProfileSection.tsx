import React from "react";
import { Section, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import { useAppUserStore } from "@/store/app-user.store";
import {
  ExperienceLevel,
  Profession,
  PROFESSIONS,
  PROFESSION_LABELS,
} from "@/types/user";
import { EXPERIENCE_LEVELS } from "@/screens/profile/edit-profile/components/constants";

/**
 * The two profile fields that change how a script is written, surfaced here
 * because that's what they're for — they were only reachable from Edit Profile,
 * three taps away from the generator they feed.
 *
 * Same two fields as Edit Profile, not a copy of them: both write through
 * `updateAppUserProfile`, which is local-first (the store and MMKV update
 * immediately, the API call syncs behind it), so the generator reads the new
 * value even if the request is still in flight or the device is offline.
 */
export function SpeakingProfileSection() {
  const appUser = useAppUserStore((s) => s.appUser);
  const updateAppUserProfile = useAppUserStore((s) => s.updateAppUserProfile);

  // No profile loaded yet — a picker with nothing selected would read as
  // "unset" and invite the user to overwrite a value they can't see.
  if (!appUser) return null;

  return (
    <Section
      title="Speaking Profile"
      footer={
        <Text>
          Used to write scripts in your voice — examples from your field, and
          pacing and delivery cues matched to your experience.
        </Text>
      }
    >
      <Picker
        label="Profession"
        selection={appUser.profession}
        onSelectionChange={(value) =>
          updateAppUserProfile({ profession: value as Profession })
        }
        modifiers={[pickerStyle("menu")]}
      >
        {PROFESSIONS.map((p) => (
          <Text key={p} modifiers={[tag(p)]}>
            {PROFESSION_LABELS[p]}
          </Text>
        ))}
      </Picker>
      <Picker
        label="Experience"
        selection={appUser.experienceLevel}
        onSelectionChange={(value) =>
          updateAppUserProfile({ experienceLevel: value as ExperienceLevel })
        }
        modifiers={[pickerStyle("menu")]}
      >
        {EXPERIENCE_LEVELS.map((level) => (
          <Text key={level.tag} modifiers={[tag(level.tag)]}>
            {level.label}
          </Text>
        ))}
      </Picker>
    </Section>
  );
}
