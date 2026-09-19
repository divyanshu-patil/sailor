import { Alert } from "react-native";
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
import { usePreferences } from "@/hooks";
import { useDailyStore } from "@/store/daily-store";
import { useStreakCountdown } from "@/screens/daily-practice/components/StreakAtRisk";

const messages = ["Hello", "Namaste", "Bonjour", "Hola", "Ciao"];

const HomeScreen = () => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { clearAppState } = useAppUserStore();
  const { resetOnboarding } = useOnboardingStore();

  const { createPreference } = usePreferences({
    onError: (error) =>
      Alert.alert("Error", error.message ?? "Failed to create preferences."),
  });

  // Read straight from the cache, not through useDailyPractice: home should
  // never fire the daily fetch, it just reflects whatever the screen last saw.
  const streak = useDailyStore((s) => s.streak);
  // Minute ticks: the footer shows hours and minutes, not seconds.
  const { target: streakTarget, remaining: streakLeft } =
    useStreakCountdown(60_000);

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

  const handleCreatePreferences = async () => {
    try {
      await createPreference({
        practiceRemindersEnabled: true,
        practiceReminderTime: "18:00",
        defaultMood: "confident",
      });
      Alert.alert("Preferences created");
    } catch {
      // error already surfaced via onError above
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
        {/* Today's practice. A section on home rather than a tab: it's a
            ten-second habit, not a place to live. Same sibling-of-(tabs) route
            shape as Discover below. */}
        <Section
          title="Today"
          footer={
            <Text modifiers={[foregroundStyle("#8E8E93")]}>
              {streakTarget?.atRisk
                ? `🔥 Your ${streakTarget.count}-day streak ends in ${Math.floor(
                    streakLeft / 3_600_000,
                  )}h ${Math.floor((streakLeft % 3_600_000) / 60_000)}m. Practise today!`
                : streak && streak.currentStreak > 0
                  ? `${streak.currentStreak} day streak. ${
                      streak.completedToday
                        ? "Done for today."
                        : "Not done yet today."
                    }`
                  : "A short snippet to read aloud, new every day."}
            </Text>
          }
        >
          <Button
            systemImage="sun.max"
            onPress={() => router.push("/(authenticated)/daily-practice")}
            modifiers={[buttonStyle("glassProminent"), tint("#F4D35E")]}
          >
            <Text>Daily practice</Text>
          </Button>
        </Section>
        {/* Discover is a full-screen route outside the tab group, so entering
            it hides the tab bar — see routes/(authenticated)/discover. */}
        <Section
          title="Discover"
          footer={
            <Text modifiers={[foregroundStyle("#8E8E93")]}>
              Public decks published by everyone using Sailor.
            </Text>
          }
        >
          <Button
            systemImage="sparkles"
            onPress={() => router.push("/(authenticated)/discover")}
            modifiers={[buttonStyle("glassProminent"), tint("#c11b5c")]}
          >
            <Text>Browse public decks</Text>
          </Button>
        </Section>
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
          <Button onPress={handleCreatePreferences}>
            <Text>Create Preferences (test)</Text>
          </Button>
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
