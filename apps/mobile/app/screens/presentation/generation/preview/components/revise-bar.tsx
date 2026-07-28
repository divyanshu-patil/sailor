// components/revise-bar.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
  shadow,
} from "@expo/ui/swift-ui/modifiers";
import { KeyboardStickyView } from "react-native-keyboard-controller";

type ReviseBarProps = {
  /** Resolves false when the revision was rejected, which keeps the typed
   *  instruction in the field instead of making the user retype it. */
  onSubmit: (instruction: string) => Promise<boolean>;
  disabled?: boolean;
  accentColor?: string;
};

export type ReviseBarRef = {
  blur: () => void;
};

const ReviseBar = forwardRef<ReviseBarRef, ReviseBarProps>(
  (
    { onSubmit, disabled: isDisabled = false, accentColor = "#B75C5C" },
    ref,
  ) => {
    const text = useNativeState("");
    const fieldRef = useRef<TextFieldRef>(null);
    const [sending, setSending] = useState(false);

    const isSendDisabled = sending || isDisabled;

    useImperativeHandle(ref, () => ({
      blur: () => {
        fieldRef.current?.blur();
      },
    }));

    const handleSend = async () => {
      const value = text.value.trim();
      if (!value || isSendDisabled) return;

      setSending(true);
      try {
        if (await onSubmit(value)) {
          fieldRef.current?.setText("");
        }
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
          modifiers={[
            shadow({
              radius: 10,
              color: "#fff",
              y: 5,
            }),
          ]}
        >
          <Namespace id="1234">
            <GlassEffectContainer>
              <HStack spacing={8} alignment={"bottom"}>
                <TextField
                  ref={fieldRef}
                  text={text}
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
                    tint(accentColor),
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
  },
);

ReviseBar.displayName = "ReviseBar";

export default ReviseBar;
