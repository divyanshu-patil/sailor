// components/settings/LegalSection.tsx
import React from "react";
import { Link } from "expo-router";
import {
  Section,
  Button,
  HStack,
  Text,
  Spacer,
  Image,
} from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";

export function LegalSection() {
  return (
    <Section title="Legal">
      <Link href={"/(authenticated)/(tabs)/(profile)/privacy-policy"} asChild>
        <Button modifiers={[buttonStyle("plain")]}>
          <HStack>
            <Text>Privacy Policy</Text>
            <Spacer />
            <Image systemName="chevron.right" size={14} color="#C7C7CC" />
          </HStack>
        </Button>
      </Link>
      <Link href={"/(authenticated)/(tabs)/(profile)/terms-of-service"} asChild>
        <Button modifiers={[buttonStyle("plain")]}>
          <HStack>
            <Text>Terms of Service</Text>
            <Spacer />
            <Image systemName="chevron.right" size={14} color="#C7C7CC" />
          </HStack>
        </Button>
      </Link>
    </Section>
  );
}
