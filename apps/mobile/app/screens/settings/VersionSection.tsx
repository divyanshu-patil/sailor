import React from "react";
import Constants from "expo-constants";
import { Section, HStack, Text, Spacer } from "@expo/ui/swift-ui";
import { font, foregroundStyle } from "@expo/ui/swift-ui/modifiers";

export function VersionSection() {
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    "1";

  return (
    <Section>
      <HStack alignment="lastTextBaseline">
        <Text>Version</Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 13 }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          {Constants.expoConfig?.version ?? "1.0.0"} ({build})
        </Text>
      </HStack>
    </Section>
  );
}
