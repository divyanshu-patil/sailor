/* eslint-disable react-hooks/immutability */
// components/revise-bar.tsx
import React, { useCallback, useRef, useState } from "react";
import {
  Host,
  HStack,
  TextField,
  TextFieldRef,
  Button,
  Image,
  useNativeState,
  Namespace,
  GlassEffectContainer,
} from "@expo/ui/swift-ui";
import {
  glassEffect,
  padding,
  buttonStyle,
  lineLimit,
  disabled,
  tint,
  buttonBorderShape,
  cornerRadius,
  controlSize,
  clipShape,
} from "@expo/ui/swift-ui/modifiers";
import { KeyboardStickyView } from "react-native-keyboard-controller";

type ReviseBarProps = {
  onSubmit: (instruction: string) => Promise<void>;
  disabled?: boolean;
};

const ReviseBar = ({
  onSubmit,
  disabled: isDisabled = false,
}: ReviseBarProps) => {
  const text = useNativeState("");
  const fieldRef = useRef<TextFieldRef>(null);
  const [sending, setSending] = useState(false);
  const [textValue, setTextValue] = useState("");

  const isSendDisabled = sending || isDisabled || textValue.trim().length === 0;

  const handleTextChange = useCallback(
    (value: string) => {
      text.value = value; // keep native state as source of truth for the field
      setTextValue(value); // mirror into React state so derived UI updates
    },
    [text],
  );

  const handleSend = async () => {
    const value = text.value.trim();
    if (!value || isSendDisabled) return;

    setSending(true);
    try {
      await onSubmit(value);
      fieldRef.current?.setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardStickyView
      style={{
        paddingHorizontal: 20,
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 20,
      }}
    >
      <Host
        matchContents={{ vertical: true }}
        style={{
          flex: 1,
        }}
        ignoreSafeArea="all"
      >
        <Namespace id="1234">
          <GlassEffectContainer>
            <HStack spacing={8} alignment={"bottom"}>
              <TextField
                ref={fieldRef}
                text={text}
                onTextChange={handleTextChange}
                placeholder="Edit With AI"
                axis="vertical"
                modifiers={[
                  padding({ horizontal: 15, vertical: 14 }),
                  lineLimit({ min: 1, max: 5 }),
                  cornerRadius(5),
                  glassEffect({
                    glass: {
                      variant: "regular",
                    },
                    shape: "roundedRectangle",
                    cornerRadius: 30,
                  }),
                ]}
              />
              <Button
                onPress={handleSend}
                modifiers={[
                  buttonStyle("glassProminent"),
                  controlSize("large"),
                  buttonBorderShape("circle"),
                  tint("#B75C5C"),
                  clipShape("circle"),
                  disabled(isSendDisabled),
                ]}
              >
                <Image systemName={"arrow.up"} />
              </Button>
            </HStack>
          </GlassEffectContainer>
        </Namespace>
      </Host>
    </KeyboardStickyView>
  );
};

export default ReviseBar;
