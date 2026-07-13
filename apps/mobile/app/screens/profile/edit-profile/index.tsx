// EditProfileScreen — SwiftUI bridge (@expo/ui/swift-ui, Expo UI ~56.x).
// No React Native <View>/<Text> for layout — Host is the single root and
// everything below it is a real SwiftUI view tree. iOS only.
//
// Avatar editing is intentionally not here right now — see
// components/AvatarPicker.tsx, which was extracted out of this screen but
// isn't wired back in yet (a different avatar picker is coming instead of
// a photo-library upload).

import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import {
  Host,
  Form,
  Section,
  HStack,
  TextField,
  Picker,
  Text,
} from "@expo/ui/swift-ui";
import {
  textInputAutocapitalization,
  textContentType,
  keyboardType,
  submitLabel,
  pickerStyle,
  tag,
  scrollDismissesKeyboard,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { EXPERIENCE_LEVELS, ROW_LABEL_MODIFIERS } from "./components/constants";
import { DeleteAccountSection } from "./components/delete-account-section";
import { useEditProfileForm } from "./hooks/use-edit-profile-form";
import { AppUserProfile, useAppUserStore } from "@/store/app-user.store";
import { userService, UserProfile } from "@/services/user.debug.service";

function toAppUserProfile(profile: UserProfile): AppUserProfile {
  return {
    id: profile.id,
    clerkUserId: profile.clerk_user_id,
    email: profile.email,
    fullName: profile.full_name,
    nickname: profile.nickname,
    experienceLevel: profile.experience_level,
    avatarUrl: profile.avatar_url,
    role: profile.role as AppUserProfile["role"],
  };
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <HStack>
      <Text modifiers={ROW_LABEL_MODIFIERS}>{label}</Text>
      {children}
    </HStack>
  );
}

export default function EditProfileScreen() {
  const appUser = useAppUserStore((s) => s.appUser);
  const setAppUser = useAppUserStore((s) => s.setAppUser);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (appUser) return; // no setState here anymore
    let cancelled = false;
    (async () => {
      try {
        const profile = await userService.getProfile();
        if (!cancelled) setAppUser(toAppUserProfile(profile));
      } catch {
        if (!cancelled) setLoadError("Couldn't load your profile. Try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appUser, setAppUser]);

  if (!appUser && !loadError) return null; // loading
  if (!appUser) return null; // error, using loadError

  // Keyed by appUser.id so EditProfileForm always mounts fresh with the
  // real profile values already in hand — see useEditProfileForm.ts for why
  // that matters for the native-state-backed text fields.
  return <EditProfileForm key={appUser.id} appUser={appUser} />;
}

function EditProfileForm({ appUser }: { appUser: AppUserProfile }) {
  const {
    router,
    isSaving,
    externalLinked,
    email,
    nameState,
    nicknameState,
    handleNameChange,
    handleNicknameChange,
    experienceLevel,
    setExperienceLevel,
    hasChanges,
    handleSave,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteAccount,
    appearanceColor,
  } = useEditProfileForm(appUser);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          tintColor={appearanceColor}
          variant="prominent"
        >
          {isSaving ? "Saving…" : "Save"}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          onPress={() => router.dismiss()}
          hidden={isSaving}
        />
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <Form modifiers={[scrollDismissesKeyboard("interactively")]}>
          {/* Basic info */}
          <Section title="Basic Info">
            <FieldRow label="Name">
              <TextField
                text={nameState}
                onTextChange={handleNameChange}
                placeholder="Your name"
                modifiers={[
                  textInputAutocapitalization("words"),
                  textContentType("name"),
                  submitLabel("next"),
                ]}
              />
            </FieldRow>
            <FieldRow label="Nickname">
              <TextField
                text={nicknameState}
                onTextChange={handleNicknameChange}
                placeholder="nickname"
                modifiers={[
                  textInputAutocapitalization("never"),
                  textContentType("nickname"),
                  keyboardType("ascii-capable"),
                  submitLabel("next"),
                ]}
              />
            </FieldRow>
          </Section>

          {/* Contact */}
          <Section
            title="Contact"
            footer={
              externalLinked.isExternalLinked ? (
                <Text
                  modifiers={[
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                  ]}
                >
                  Your email is managed by your linked {externalLinked.provider}{" "}
                  account.
                </Text>
              ) : undefined
            }
          >
            <FieldRow label="Email">
              <Text>{email}</Text>
            </FieldRow>
          </Section>

          {/* Speaking profile */}
          <Section title="Speaking Profile">
            <Picker
              label="Experience Level"
              selection={experienceLevel}
              onSelectionChange={(value) =>
                setExperienceLevel(value as typeof experienceLevel)
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

          <DeleteAccountSection
            isPresented={showDeleteConfirm}
            onIsPresentedChange={setShowDeleteConfirm}
            onConfirmDelete={handleDeleteAccount}
          />
        </Form>
      </Host>
    </>
  );
}
