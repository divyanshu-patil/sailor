// EditProfileScreen.tsx
// Built entirely with @expo/ui/swift-ui (SwiftUI bridge, Expo UI ~56.x).
// No React Native <View>/<Text> are used for layout — Host is the single
// root and everything below it is a real SwiftUI view tree.
//
// Requires a dev client (Expo UI ships in Expo Go as of SDK 56, but a dev
// client is still recommended). iOS only — this file has no Android path.

import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
// TODO: wire up the real Clerk hook here, e.g.:
//   import { useUser } from "@clerk/clerk-expo";
import {
  Host,
  Form,
  Section,
  TextField,
  Picker,
  Button,
  Text,
  Image,
  HStack,
  VStack,
  Spacer,
  Overlay,
  Alert,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  padding,
  frame,
  clipShape,
  resizable,
  aspectRatio,
  buttonStyle,
  controlSize,
  tint,
  disabled,
  keyboardType,
  textInputAutocapitalization,
  textContentType,
  submitLabel,
  pickerStyle,
  tag,
  scrollDismissesKeyboard,
} from "@expo/ui/swift-ui/modifiers";
import HeaderTitlePill from "./components/header-title";

// ---------------------------------------------------------------------------
// Types + dummy data — swap DEFAULT_PROFILE for whatever the Profile screen
// already loaded (pass it in via route params / a store) and swap
// `saveProfile` for the real profileService, following the same
// typed-interface + dummy-in-memory pattern used elsewhere in the app.
// ---------------------------------------------------------------------------

type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "pro";

interface ProfileFormValues {
  avatarUri: string | null;
  fullName: string;
  username: string;
  email: string;
  experienceLevel: ExperienceLevel;
}

const DEFAULT_PROFILE: ProfileFormValues = {
  avatarUri: null,
  fullName: "Div Patel",
  username: "divp",
  email: "div@example.com",
  experienceLevel: "intermediate",
};

// TODO: replace with the real Clerk hook, e.g.:
//   const { user } = useUser();
//   const googleAccount = user?.externalAccounts.find(
//     (a) => a.provider === "oauth_google",
//   );
//   const isEmailGoogleLinked = !!googleAccount;
//   const linkedEmail =
//     googleAccount?.emailAddress ?? user?.primaryEmailAddress?.emailAddress;
// This is a dummy in-memory stand-in following the same pattern as
// `saveProfile` below — swap it out once Clerk is wired in.
const CLERK_GOOGLE_LINK = {
  isEmailGoogleLinked: true,
};

const EXPERIENCE_LEVELS: { tag: ExperienceLevel; label: string }[] = [
  { tag: "beginner", label: "Beginner" },
  { tag: "intermediate", label: "Intermediate" },
  { tag: "advanced", label: "Advanced" },
  { tag: "pro", label: "Pro speaker" },
];

async function saveProfile(values: ProfileFormValues): Promise<void> {
  // TODO: replace with profileService.updateProfile(values)
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const ACCENT = "#6C5CE7"; // swap for the Sailors brand accent
const DESTRUCTIVE_RED = "#FF3B30"; // iOS system red

const EditProfileScreen = () => {
  const router = useRouter();
  const initial = DEFAULT_PROFILE;
  const isEmailGoogleLinked = CLERK_GOOGLE_LINK.isEmailGoogleLinked;

  // Regular RN state for anything that drives conditional rendering or JS logic.
  const [avatarUri, setAvatarUri] = useState<string | null>(initial.avatarUri);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    initial.experienceLevel,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Native-state-backed text fields. initialValue is only read on the first
  // render, so `initial` needs to already be the real profile by the time
  // this component mounts (i.e. loaded by the screen that navigates here).
  const nameState = useNativeState(initial.fullName);
  const usernameState = useNativeState(initial.username);
  // When email is linked via Google (through Clerk), it's managed on the
  // Google side and shown read-only here rather than as an editable field.
  const emailState = useNativeState(initial.email);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorVisible(true);
  }, []);

  const pickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError(
        "Allow photo library access in Settings to change your avatar.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [showError]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveProfile({
        avatarUri,
        fullName: nameState.value.trim(),
        username: usernameState.value.trim(),
        // If the email is Google-linked, it isn't editable here, so send the
        // original value through untouched rather than whatever's in the
        // (disabled) field.
        email: isEmailGoogleLinked ? initial.email : emailState.value.trim(),
        experienceLevel,
      });
      router.back();
    } catch {
      showError("Something went wrong saving your profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    avatarUri,
    experienceLevel,
    isEmailGoogleLinked,
    initial.email,
    nameState,
    usernameState,
    emailState,
    router,
    showError,
  ]);

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteConfirm(false);
    // TODO: wire up to the real delete-account flow
    console.log("Account deletion requested");
  }, []);

  const rowLabelModifiers = [
    frame({ width: 92, alignment: "leading" as const }),
    foregroundStyle({
      type: "hierarchical" as const,
      style: "secondary" as const,
    }),
  ];

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          onPress={handleSave}
          hidden={isSaving}
          tintColor={ACCENT}
          variant="prominent"
        >
          Save
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          hidden={!isSaving}
          onPress={() => {}}
          tintColor={ACCENT}
          variant="prominent"
        >
          Saving…
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"xmark"}
          onPress={() => router.dismiss()}
          hidden={isSaving}
        />
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <Form modifiers={[scrollDismissesKeyboard("interactively")]}>
          {/* Avatar */}
          <Section>
            <HStack>
              <Spacer />
              <VStack spacing={10} modifiers={[padding({ vertical: 12 })]}>
                <Overlay alignment="bottomTrailing">
                  {avatarUri ? (
                    <Image
                      uiImage={avatarUri}
                      modifiers={[
                        resizable(),
                        aspectRatio({ contentMode: "fill" }),
                        frame({ width: 96, height: 96 }),
                        clipShape("circle"),
                      ]}
                    />
                  ) : (
                    <Image
                      systemName="person.crop.circle.fill"
                      size={96}
                      color="#C7C7CC"
                    />
                  )}
                  <Overlay.Content>
                    <Button
                      onPress={pickAvatar}
                      modifiers={[
                        buttonStyle("borderedProminent"),
                        controlSize("mini"),
                        tint(ACCENT),
                        clipShape("circle"),
                      ]}
                    >
                      <Image systemName="pencil" size={12} color="white" />
                    </Button>
                  </Overlay.Content>
                </Overlay>
                <Button
                  label="Change Photo"
                  onPress={pickAvatar}
                  modifiers={[
                    buttonStyle("plain"),
                    font({ size: 15, weight: "semibold" }),
                    foregroundStyle(ACCENT),
                  ]}
                />
              </VStack>
              <Spacer />
            </HStack>
          </Section>

          {/* Basic info */}
          <Section title="Basic Info">
            <HStack>
              <Text modifiers={rowLabelModifiers}>Name</Text>
              <TextField
                text={nameState}
                placeholder="Your name"
                modifiers={[
                  textInputAutocapitalization("words"),
                  textContentType("name"),
                  submitLabel("next"),
                ]}
              />
            </HStack>
            <HStack>
              <Text modifiers={rowLabelModifiers}>Username</Text>
              <TextField
                text={usernameState}
                placeholder="username"
                modifiers={[
                  textInputAutocapitalization("never"),
                  textContentType("username"),
                  keyboardType("ascii-capable"),
                  submitLabel("next"),
                ]}
              />
            </HStack>
          </Section>

          {/* Contact */}
          <Section
            title="Contact"
            footer={
              isEmailGoogleLinked ? (
                <Text
                  modifiers={[
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                  ]}
                >
                  Your email is managed by your linked Google account. Update it
                  there to change it here.
                </Text>
              ) : undefined
            }
          >
            <HStack>
              <Text modifiers={rowLabelModifiers}>Email</Text>
              <Text>{emailState.value}</Text>
            </HStack>
          </Section>

          {/* Speaking profile */}
          <Section title="Speaking Profile">
            <Picker
              label="Experience Level"
              selection={experienceLevel}
              onSelectionChange={(value) =>
                setExperienceLevel(value as ExperienceLevel)
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

          {/* Account management */}
          <Section
            title="Account Management"
            footer={
              <Text>
                This permanently deletes your account, scripts, and practice
                history.
              </Text>
            }
          >
            <Alert
              title="Delete account?"
              isPresented={showDeleteConfirm}
              onIsPresentedChange={setShowDeleteConfirm}
            >
              <Alert.Trigger>
                <Button
                  label="Delete Account"
                  role="destructive"
                  onPress={() => setShowDeleteConfirm(true)}
                  modifiers={[
                    buttonStyle("plain"),
                    foregroundStyle(DESTRUCTIVE_RED),
                  ]}
                />
              </Alert.Trigger>
              <Alert.Actions>
                <Button
                  label="Delete"
                  role="destructive"
                  onPress={handleDeleteAccount}
                />
                <Button label="Cancel" role="cancel" />
              </Alert.Actions>
              <Alert.Message>
                <Text>
                  This permanently deletes your account and all data. This
                  cannot be undone.
                </Text>
              </Alert.Message>
            </Alert>
          </Section>
        </Form>
      </Host>
    </>
  );
};

export default EditProfileScreen;
