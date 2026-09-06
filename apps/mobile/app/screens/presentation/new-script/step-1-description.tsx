import React, { useCallback, useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  KeyboardController,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import {
  Host,
  TextField,
  Text,
  Menu,
  Button,
  HStack,
  VStack,
  Spacer,
  Image,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  imageScale,
  lineLimit,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import Mascot from "@/components/ui/mascot";
import { usePresentationForm } from "./form-context";
import AttachmentStack from "./components/AttachmentStack";

/** Fixed, so the canvas never re-measures. A canvas that changes size resizes
 *  its composition on the spot — no animation — which is what made the mascot
 *  jump instead of easing when the keyboard came up. */
const MASCOT_SIZE = Math.min(Dimensions.get("window").width * 0.66, 300);

const RUST = "#B75C5C";
const INK = "#1B1B1B";

interface StepDescriptionProps {
  /** The arrow in the composer is the only way forward on this step. */
  onSend: () => void;
  canSend: boolean;
  /** False while another step is on screen. This one stays mounted behind it. */
  active: boolean;
}

export default function StepDescription({
  onSend,
  canSend,
  active,
}: StepDescriptionProps) {
  const {
    form,
    addAttachment,
    removeAttachment,
    retryAttachment,
    descriptionState,
    handleSetDescriptionValue,
  } = usePresentationForm();

  // This step stays mounted behind the others now, and a focused field would
  // otherwise keep the keyboard up over them.
  useEffect(() => {
    if (!active) KeyboardController.dismiss();
  }, [active]);

  const insets = useSafeAreaInsets();

  // Where the keyboard actually is, sampled every frame.
  //
  // Not `useReanimatedKeyboardAnimation`: on iOS that hook writes its shared
  // values from `onKeyboardMoveStart`, and that event carries the *destination*
  // height — so the value teleports and anything driven off it snaps. `onMove`
  // is the per-frame event, fed by a display link reading the keyboard's real
  // position, so following it is as close to the keyboard as it is possible to
  // be. No easing of our own to go out of step with it.
  const keyboard = useSharedValue(0);
  const progress = useSharedValue(0);
  useKeyboardHandler(
    {
      onMove: (e) => {
        "worklet";
        keyboard.value = e.height;
        progress.value = e.progress;
      },
      onInteractive: (e) => {
        "worklet";
        keyboard.value = e.height;
        progress.value = e.progress;
      },
      // The last frame can be missed by a display link; this pins the ends.
      onEnd: (e) => {
        "worklet";
        keyboard.value = e.height;
        progress.value = e.progress;
      },
    },
    [],
  );

  // Lifting the bottom block rather than resizing the screen: the card's height
  // changes as the user types, and a translation doesn't care what that height
  // is. The screen's bottom inset is under the keyboard anyway, so it comes
  // back off the lift.
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.value - insets.bottom) }],
  }));

  // The mascot follows a fraction of the way and gives up some size with it, so
  // the top half reads as compressing rather than sitting still while the
  // composer slides over it.
  const squeeze = useAnimatedStyle(() => ({
    transform: [
      { translateY: -keyboard.value * 0.3 },
      { scale: 1 - 0.22 * progress.value },
    ],
  }));

  const addImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    result.assets.forEach((asset, i) => {
      addAttachment({
        id: `img-${Date.now()}-${i}`,
        kind: "image",
        name: asset.fileName ?? `Image ${form.attachments.length + i + 1}`,
        uri: asset.uri,
        // The API accepts JPEG and PNG only; the picker reports what it picked.
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.fileSize,
      });
    });
  }, [addAttachment, form.attachments.length]);

  const addDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // PowerPoint — the whole reason documents are supported at all.
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ],
    });
    if (result.canceled) return;
    result.assets.forEach((asset, i) => {
      addAttachment({
        id: `doc-${Date.now()}-${i}`,
        kind: "document",
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? "application/pdf",
        sizeBytes: asset.size,
      });
    });
  }, [addAttachment]);

  return (
    <View style={styles.root}>
      {/* The multiline field has no return key to dismiss with, so the empty
          space above it is the way out. */}
      <AnimatedPressable
        style={[styles.mascotWrap, squeeze]}
        onPress={() => KeyboardController.dismiss()}
      >
        <Mascot size={MASCOT_SIZE} playing={active} />
      </AnimatedPressable>

      <Animated.View style={lift}>
        <AttachmentStack
          attachments={form.attachments}
          onRemove={removeAttachment}
          onRetry={retryAttachment}
        />

        <View
          style={[styles.composerWrap, { paddingBottom: insets.bottom + 8 }]}
        >
          <View style={styles.composer}>
            <Host
              matchContents={{ vertical: true }}
              style={styles.hostFill}
              // SwiftUI does its own keyboard avoidance; left on, the card gets
              // shifted twice — once by the host, once by the lift above.
              ignoreSafeArea="keyboard"
            >
              <VStack spacing={14} alignment="leading">
                <TextField
                  axis="vertical"
                  text={descriptionState}
                  onTextChange={handleSetDescriptionValue}
                  modifiers={[
                    font({ size: 16 }),
                    foregroundStyle(INK),
                    tint(RUST),
                    // One line to start — reserving two left an empty line
                    // hanging over the + and the arrow. Six is where it stops
                    // growing; past that the composer would eat the mascot.
                    lineLimit({ min: 1, max: 6 }),
                  ]}
                >
                  <TextField.Placeholder>
                    <Text
                      modifiers={[
                        font({ size: 16 }),
                        foregroundStyle("#A39B94"),
                      ]}
                    >
                      What is this script about?
                    </Text>
                  </TextField.Placeholder>
                </TextField>

                <HStack>
                  <Menu
                    label=""
                    systemImage="plus"
                    modifiers={[
                      tint(INK),
                      foregroundStyle(INK),
                      imageScale("large"),
                      font({ size: 22 }),
                    ]}
                  >
                    <Button onPress={addImage}>
                      <HStack spacing={6}>
                        <Image systemName="photo" size={15} />
                        <Text>Image</Text>
                      </HStack>
                    </Button>
                    <Button onPress={addDocument}>
                      <HStack spacing={6}>
                        <Image systemName="doc.text" size={15} />
                        <Text>Document</Text>
                      </HStack>
                    </Button>
                  </Menu>

                  <Spacer />

                  <Button
                    onPress={onSend}
                    modifiers={[
                      buttonStyle("borderedProminent"),
                      buttonBorderShape("capsule"),
                      controlSize("extraLarge"),
                      tint(RUST),
                      disabled(!canSend),
                    ]}
                  >
                    <Image systemName="arrow.right" size={18} />
                  </Button>
                </HStack>
              </VStack>
            </Host>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  mascotWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  composerWrap: { paddingHorizontal: 16 },
  composer: {
    backgroundColor: "#FCFBFA",
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
  },
  hostFill: { width: "100%" },
});
