import { Host, Text } from "@expo/ui/swift-ui";
import { glassEffect, padding } from "@expo/ui/swift-ui/modifiers";
import { View, StyleSheet } from "react-native";

export default function HeaderTitlePill({
  title,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Host
      matchContents
      modifiers={[
        glassEffect({
          glass: {
            variant: "regular",
          },
        }),
        padding({ horizontal: 16, vertical: 6 }),
      ]}
    >
      <Text>{title}</Text>
    </Host>
  );
}

const pillStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(120, 120, 128, 0.12)",
    alignItems: "center",
    minWidth: 120,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(60, 60, 67, 0.6)",
    marginTop: 1,
  },
});
