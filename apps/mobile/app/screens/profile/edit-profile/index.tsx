import React, { useEffect } from "react";
import { Stack } from "expo-router";
import {
  Host,
  Form,
  Section,
  HStack,
  TextField,
  Picker,
  Text,
  Spacer,
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
import {
  EXPERIENCE_LEVELS,
  PROFESSIONS,
  PROFESSION_LABELS,
  rowLabelModifiers,
} from "./components/constants";
import { DeleteAccountSection } from "./components/delete-account-section";
import { useEditProfileForm } from "./hooks/use-edit-profile-form";
import { useUser } from "@/hooks/use-user";
import { AppUserProfile, useAppUserStore } from "@/store/app-user.store";

function toAppUserProfile(
  profile: any,
  existingEmail?: string,
): AppUserProfile {
  return {
    id: profile.id,
    clerkUserId: profile.clerk_user_id,
    email: profile.email || existingEmail || "",
    fullName: profile.full_name,
    nickname: profile.nickname,
    experienceLevel: profile.experience_level,
    profession: profile.profession,
    avatarUrl: profile.avatar_url,
    role: profile.role as AppUserProfile["role"],
  };
}

function FieldRow({
  label,
  children,
  withPicker,
}: {
  label: string;
  children: React.ReactNode;
  withPicker?: boolean;
}) {
  return (
    <HStack>
      <Text modifiers={rowLabelModifiers(withPicker)}>{label}</Text>
      {children}
    </HStack>
  );
}

export default function EditProfileScreen() {
  const appUser = useAppUserStore((s) => s.appUser);
  const setAppUser = useAppUserStore((s) => s.setAppUser);

  // Use useUser hook for profile data with debug service
  const { data: profile, isLoading } = useUser();

  // Sync profile data to store when fetched
  useEffect(() => {
    if (profile) {
      const existingEmail = appUser?.email;
      setAppUser(toAppUserProfile(profile, existingEmail));
    }
  }, [profile, appUser?.email, setAppUser]);

  if (isLoading && !appUser) return null; // loading
  if (!appUser) return null; // error or no data

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
    profession,
    handleProfessionChange,
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
            {/* <FieldRow label="Profession"> */}
            {/* <Spacer /> */}
            <Picker
              label={"Profession"}
              selection={profession}
              onSelectionChange={(value) =>
                handleProfessionChange(value as string)
              }
              modifiers={[pickerStyle("menu"), ...rowLabelModifiers(true)]}
            >
              {PROFESSIONS.map((p) => (
                <Text key={p} modifiers={[tag(p)]}>
                  {PROFESSION_LABELS[p]}
                </Text>
              ))}
            </Picker>
            {/* </FieldRow> */}
            <FieldRow label="Experience Level" withPicker>
              <Spacer />
              <Picker
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
            </FieldRow>
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
