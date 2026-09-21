import React from "react";
import {
  Button,
  HStack,
  Image,
  Overlay,
  Section,
  Text,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  foregroundStyle,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";

import { DECK_PALETTE } from "@/constants/deck-palette";

interface StreakWidgetSectionProps {
  selectedColor: string;
  onSelect: (hex: string) => void;
}

/**
 * The streak widget's background.
 *
 * The app's deck palette rather than a new set of colours: these are already the
 * shades the rest of Sailors is designed against, and a widget is the one surface
 * where a colour nobody vetted sits next to the user's wallpaper all day.
 */
export function StreakWidgetSection({
  selectedColor,
  onSelect,
}: StreakWidgetSectionProps) {
  return (
    <Section
      title="Streak Widget"
      footer={
        <Text modifiers={[foregroundStyle("#8E8E93")]}>
          The background of the streak widget on your home screen.
        </Text>
      }
    >
      <HStack
        spacing={16}
        modifiers={[padding({ vertical: 8 }), frame({ maxWidth: Infinity })]}
      >
        {DECK_PALETTE.map((hex) => (
          <Button
            key={hex}
            onPress={() => onSelect(hex)}
            modifiers={[buttonStyle("plain")]}
          >
            <Overlay alignment="center">
              <Image systemName="circle.fill" size={34} color={hex} />
              {hex === selectedColor && (
                <Overlay.Content>
                  <Image systemName="checkmark" size={14} color="#1B1B1B" />
                </Overlay.Content>
              )}
            </Overlay>
          </Button>
        ))}
      </HStack>
    </Section>
  );
}
