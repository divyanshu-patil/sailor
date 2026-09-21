import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Host, Form, Section, HStack, TextField, Text } from "@expo/ui/swift-ui";
import {
  textInputAutocapitalization,
  textContentType,
  keyboardType,
  submitLabel,
  scrollDismissesKeyboard,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { rowLabelModifiers } from "./components/constants";
import ProfilePhotoSection from "./components/profile-photo-section";
import { useEditProfileForm } from "./hooks/use-edit-profile-form";
import { useUser } from "@/hooks/use-user";
import { useProfileIdentity } from "@/hooks/use-profile-identity";
import { AppUserProfile, useAppUserStore } from "@/store/app-user.store";

function toAppUserProfile(
  profile: any,
  fallback: { fullName?: string; email?: string | null },
): AppUserProfile {
  return {
    id: profile.id,
    clerkUserId: profile.clerk_user_id,
    email: profile.email || fallback.email || "",
    // The backend row starts with no name; fall back to the name from Clerk so
    // Edit Profile shows the same identity the Profile screen does.
    fullName: profile.full_name || fallback.fullName || "",
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <HStack>
      <Text modifiers={rowLabelModifiers()}>{label}</Text>
      {children}
    </HStack>
  );
}

export default function EditProfileScreen() {
  const appUser = useAppUserStore((s) => s.appUser);
  const setAppUser = useAppUserStore((s) => s.setAppUser);

  const { data: profile, isLoading } = useUser();
  const identity = useProfileIdentity();

  // Sync profile data to store when fetched, seeding the identity fields from
  // Clerk when the backend row doesn't carry them yet.
  useEffect(() => {
    if (profile) {
      setAppUser(
        toAppUserProfile(profile, {
          fullName: identity.displayName,
          email: identity.email || appUser?.email,
        }),
      );
    }
  }, [profile, identity.displayName, identity.email, appUser?.email, setAppUser]);

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
    hasChanges,
    handleSave,
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

      <View style={styles.screen}>
        <ProfilePhotoSection />

        <Host style={styles.formHost}>
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
                  maxLength={10}
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
                    Your email is managed by your linked{" "}
                    {externalLinked.provider} account.
                  </Text>
                ) : undefined
              }
            >
              <FieldRow label="Email">
                <Text>{email}</Text>
              </FieldRow>
            </Section>
          </Form>
        </Host>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  formHost: {
    flex: 1,
  },
});
