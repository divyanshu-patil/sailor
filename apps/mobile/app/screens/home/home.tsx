import { Alert, StyleSheet } from "react-native";
import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/auth-store";
// import useAuthenticated from "@/hooks/use-authenticated";
import {
  Host,
  Form,
  Section,
  Text,
  Button,
  Toggle,
  HStack,
  Image,
  Spacer,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  buttonStyle,
  contentTransition,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useAuth } from "@clerk/expo";

const messages = ["Hello", "Namaste", "Bonjour", "Hola", "Ciao"];

const HomeScreen = () => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000); // changes every 2 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isSignedIn) {
    return (
      <Host matchContents>
        <Text>Please login to continue</Text>
      </Host>
    );
  }

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section>
          <HStack spacing={8}>
            <Text>Notifications</Text>
            <Spacer />
            <Toggle isOn={notifications} onIsOnChange={setNotifications} />
          </HStack>
          {/* <Button
            role="destructive"
            // modifiers={[buttonStyle("glassProminent")]}
            onPress={() => Alert.alert("Tapped")}
            systemImage="cross"

          >
            <Text>Bordered Button</Text> 
          </Button> 
          */}
          <Button
            onPress={() => Alert.alert("Tapped")}
            modifiers={[
              buttonStyle("glassProminent"),
              tint("#e9347b"),
              animation(Animation.default, messageIndex),
            ]}
          >
            <Text
              modifiers={[
                contentTransition("numericText", { countsDown: true }),
                animation(Animation.default, messageIndex),
              ]}
            >
              {messages[messageIndex]}
            </Text>
          </Button>
        </Section>
      </Form>
    </Host>
  );
};

export default HomeScreen;
