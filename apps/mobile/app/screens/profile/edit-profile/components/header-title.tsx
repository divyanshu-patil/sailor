import { Host, Text } from "@expo/ui/swift-ui";
import { glassEffect, padding } from "@expo/ui/swift-ui/modifiers";
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

