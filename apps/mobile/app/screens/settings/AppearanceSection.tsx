import React from "react";
import {
  Section,
  VStack,
  HStack,
  Button,
  Overlay,
  Image,
  Text,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  buttonStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { useAppearanceOptions } from "@/hooks";

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    result.push(items.slice(i, i + size));
  return result;
}

interface AppearanceSectionProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AppearanceSection({
  selectedId,
  onSelect,
}: AppearanceSectionProps) {
  const { data: options, isLoading } = useAppearanceOptions();

  if (isLoading || !options) return null;

  return (
    <Section title="Appearance">
      <VStack spacing={16} modifiers={[padding({ vertical: 8 })]}>
        {chunk(options, 3).map((row, rowIndex) => (
          <HStack key={rowIndex} spacing={24}>
            {row.map((option) => {
              const isSelected = option.id === selectedId;
              return (
                <Button
                  key={option.id}
                  onPress={() => onSelect(option.id)}
                  modifiers={[buttonStyle("plain")]}
                >
                  <VStack spacing={6}>
                    <Overlay alignment="center">
                      <Image
                        systemName="circle.fill"
                        size={44}
                        color={option.hex}
                      />
                      {isSelected && (
                        <Overlay.Content>
                          <Image
                            systemName="checkmark"
                            size={16}
                            color="white"
                          />
                        </Overlay.Content>
                      )}
                    </Overlay>
                    <Text
                      modifiers={[
                        font({ size: 12 }),
                        foregroundStyle({
                          type: "hierarchical",
                          style: "secondary",
                        }),
                      ]}
                    >
                      {option.name}
                    </Text>
                  </VStack>
                </Button>
              );
            })}
          </HStack>
        ))}
      </VStack>
    </Section>
  );
}
