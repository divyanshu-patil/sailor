import {
  VStack,
  HStack,
  Button,
  Text as SwiftUIText,
  Spacer,
  Image as SwiftUIImage,
} from "@expo/ui/swift-ui";
import {
  background,
  cornerRadius,
  padding,
  tint,
  buttonStyle,
  frame,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { type SFSymbol } from "expo-symbols";

export const SettingsRow = ({
  icon,
  iconColor,
  label,
  onPress,
}: {
  icon: SFSymbol;
  iconColor: string;
  label: string;
  onPress: () => void;
}) => (
  <Button onPress={onPress} modifiers={[tint("#000000"), buttonStyle("plain")]}>
    <HStack spacing={12} modifiers={[padding({ vertical: 10 })]}>
      <VStack
        modifiers={[
          background(iconColor),
          cornerRadius(8),
          frame({ width: 30, height: 30 }),
        ]}
      >
        <SwiftUIImage
          systemName={icon}
          modifiers={[foregroundStyle("#FFFFFF")]}
        />
      </VStack>
      <SwiftUIText>{label}</SwiftUIText>
      <Spacer />
      <SwiftUIImage
        systemName="chevron.right"
        modifiers={[foregroundStyle("#C7C7CC")]}
      />
    </HStack>
  </Button>
);
