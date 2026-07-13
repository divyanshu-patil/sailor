import React, { useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  HStack,
  VStack,
  Spacer,
  Overlay,
  Image,
  Button,
} from "@expo/ui/swift-ui";
import {
  padding,
  frame,
  clipShape,
  resizable,
  aspectRatio,
  buttonStyle,
  controlSize,
  tint,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";

// Extracted from EditProfileScreen as-is. Not currently used anywhere —
// avatar editing is going to move to a different-avatar-style picker
// instead of a photo-library upload, so this is parked here rather than
// wired back into the edit-profile screen for now.

interface AvatarPickerProps {
  avatarUri: string | null;
  onAvatarSelected: (uri: string) => void;
  onError: (message: string) => void;
  tintColor: string;
  size?: number;
}

export function AvatarPicker({
  avatarUri,
  onAvatarSelected,
  onError,
  tintColor,
  size = 96,
}: AvatarPickerProps) {
  const pickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Allow photo library access in Settings to change your avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onAvatarSelected(result.assets[0].uri);
    }
  }, [onAvatarSelected, onError]);

  return (
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
                frame({ width: size, height: size }),
                clipShape("circle"),
              ]}
            />
          ) : (
            <Image
              systemName="person.crop.circle.fill"
              size={size}
              color="#C7C7CC"
            />
          )}
          <Overlay.Content>
            <Button
              onPress={pickAvatar}
              modifiers={[
                buttonStyle("borderedProminent"),
                controlSize("mini"),
                tint(tintColor),
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
            foregroundStyle(tintColor),
          ]}
        />
      </VStack>
      <Spacer />
    </HStack>
  );
}
