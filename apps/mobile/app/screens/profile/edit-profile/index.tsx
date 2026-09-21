import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import {
  ContentUnavailableView,
  Form,
  HStack,
  Host,
  Section,
  Text,
  TextField,
} from "@expo/ui/swift-ui";
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

/**
 * A profile built from Clerk alone, for when the backend row cannot be read.
 *
 * Enough to render and edit the form; `id` is the Clerk id so the `key` below
 * is still stable. Returns null before Clerk has its user, which is the only
 * state where there is genuinely nothing to show.
 */
function identityOnlyProfile(identity: {
  displayName: string;
  email: string | null;
  isLoaded: boolean;
}): AppUserProfile | null {
  if (!identity.isLoaded) return null;
  return {
    id: "identity-only",
    clerkUserId: "",
    email: identity.email ?? "",
    fullName: identity.displayName,
    nickname: "",
    experienceLevel: "beginner",
    profession: null,
    avatarUrl: null,
    role: "user",
  };
}

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
  }, [
    profile,
    identity.displayName,
    identity.email,
    appUser?.email,
    setAppUser,
  ]);

  // Never a bare `null`: this screen rendered nothing at all whenever the
  // profile fetch failed and the store was empty — offline, or with the API
  // down — which is the blank Edit Profile.
  //
  // The persisted store is the first fallback and Clerk's identity the second,
  // so the form opens with the name and email the rest of the app is already
  // showing. A save still goes through `updateAppUserProfile`, which is
  // local-first and syncs when it can.
  const fallbackUser: AppUserProfile | null =
    appUser ?? identityOnlyProfile(identity);

  if (!fallbackUser) {
    return (
      <Host style={styles.formHost}>
        <ContentUnavailableView
          title={isLoading ? "Loading your profile" : "Profile unavailable"}
          systemImage={isLoading ? "person.crop.circle" : "wifi.slash"}
          description={
            isLoading
              ? "One moment."
              : "We couldn't load your profile. Check your connection and try again."
          }
        />
      </Host>
    );
  }

  // Keyed by the profile id so EditProfileForm always mounts fresh with the
  // real values already in hand — see useEditProfileForm.ts for why that
  // matters for the native-state-backed text fields.
  return <EditProfileForm key={fallbackUser.id} appUser={fallbackUser} />;
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

      {/* One SwiftUI host for the whole screen. The photo used to be a React
          Native row above this, which is what made it sit still while the form
          scrolled under it. */}
      <Host style={styles.formHost}>
        <Form modifiers={[scrollDismissesKeyboard("interactively")]}>
          <ProfilePhotoSection />

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
        </Form>
      </Host>
    </>
  );
}

const styles = StyleSheet.create({
  formHost: { flex: 1 },
});
