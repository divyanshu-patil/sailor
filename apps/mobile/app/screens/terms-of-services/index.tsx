// TermsOfServiceScreen.tsx
// Same rationale as PrivacyPolicyScreen: plain RN ScrollView + Text for
// long-form static content. Placeholder copy — swap for the real,
// legally-reviewed terms before release.

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";

const LAST_UPDATED = "July 11, 2026";

const TermsOfServiceScreen = () => {
  return (
    <>
      <Stack.Screen options={{ title: "Terms of Service" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Section title="1. Acceptance of Terms">
          By creating an account or using the app, you agree to these terms.
          TODO: replace this placeholder with the legally-reviewed terms for
          your jurisdiction(s) before release.
        </Section>

        <Section title="2. Using the App">
          You agree to use the app only for its intended purpose of practicing
          and refining spoken presentations, and not to misuse it in ways that
          could harm the service or other users.
        </Section>

        <Section title="3. Your Content">
          You retain ownership of the scripts, decks, and recordings you create.
          By using the app, you grant us a limited license to store and process
          that content solely to provide the app&apos;s features to you.
        </Section>

        <Section title="4. Subscriptions and Billing">
          Some features require a paid subscription, billed through the App
          Store or Google Play. Subscriptions renew automatically unless
          cancelled at least 24 hours before the end of the current period, per
          the app store&apos;s standard terms.
        </Section>

        <Section title="5. Termination">
          You may delete your account at any time from Settings. We may suspend
          or terminate accounts that violate these terms or applicable law.
        </Section>

        <Section title="6. Disclaimers">
          The app is provided &quot;as is&quot; without warranties of any kind.
          We do not guarantee that the app will be uninterrupted, error-free, or
          suitable for every use case.
        </Section>

        <Section title="7. Contact Us">
          If you have questions about these terms, contact us at
          legal@example.com. TODO: replace with your real support address.
        </Section>
      </ScrollView>
    </>
  );
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  updated: {
    fontSize: 13,
    color: "rgba(60, 60, 67, 0.6)",
    marginBottom: 20,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    color: "#000",
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(0, 0, 0, 0.75)",
  },
});

export default TermsOfServiceScreen;
