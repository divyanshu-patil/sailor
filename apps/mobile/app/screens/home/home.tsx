import { Alert, StyleSheet } from "react-native";
import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAppUserStore } from "@/store/app-user.store";
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
  SwipeActions,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  buttonStyle,
  contentTransition,
  foregroundStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useOnboardingStore } from "@/store/onboarding.store";

const messages = ["Hello", "Namaste", "Bonjour", "Hola", "Ciao"];

const HomeScreen = () => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { clearAppState } = useAppUserStore();
  const { resetOnboarding } = useOnboardingStore();

  const [notifications, setNotifications] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  const handleSignOut = async () => {
    try {
      clearAppState();
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "An error occurred while signing out.");
    }
  };

  const handleClearOnboardingAndSignOut = async () => {
    try {
      resetOnboarding();
      clearAppState();
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "An error occurred while signing out.");
    }
  };

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
        <Section>
          <SwipeActions>
            <Text>firstName: {user?.firstName}</Text>
            <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
              <Button
                label="Verify"
                systemImage="checkmark"
                modifiers={[tint("#34c759")]}
                onPress={() => Alert.alert("Verified", "First name confirmed")}
              />
            </SwipeActions.Actions>
          </SwipeActions>

          <SwipeActions>
            <Text>lastName: {user?.lastName}</Text>
            <SwipeActions.Actions edge="leading">
              <Button
                label="delete"
                systemImage="checkmark"
                modifiers={[tint("#dd0e61")]}
                onPress={() => Alert.alert("Verified", "Last name confirmed")}
              />
            </SwipeActions.Actions>
          </SwipeActions>
        </Section>
        <Section>
          <Button onPress={handleSignOut}>
            <Text modifiers={[foregroundStyle("#f00")]}>LogOut</Text>
          </Button>
        </Section>
        <Section>
          <Button onPress={handleClearOnboardingAndSignOut}>
            <Text>Clear Onboarding and Sign Out</Text>
          </Button>
        </Section>
      </Form>
    </Host>
  );
};

export default HomeScreen;
