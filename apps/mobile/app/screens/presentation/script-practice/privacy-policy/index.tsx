// PrivacyPolicyScreen.tsx
// Plain RN (not swift-ui) — this is long-form static text, so a ScrollView
// + Text is simpler and more accessible than building it out of SwiftUI
// primitives. Swap the copy below for the real, legally-reviewed policy
// before shipping; this is a structural placeholder only.

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";

const LAST_UPDATED = "July 11, 2026";

const PrivacyPolicyScreen = () => {
  return (
    <>
      <Stack.Screen options={{ title: "Privacy Policy" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Section title="1. Introduction">
          This policy explains what information we collect when you use the app,
          why we collect it, and the choices you have. TODO: replace this
          placeholder with the legally-reviewed policy for your jurisdiction(s)
          before release.
        </Section>

        <Section title="2. Information We Collect">
          Account details you provide (such as your name and email), content you
          create in the app (scripts, decks, and practice recordings), and basic
          usage data (device type, crash logs, feature usage) collected to keep
          the app working and improve it.
        </Section>

        <Section title="3. How We Use Your Information">
          To provide and maintain the app&apos;s core features, to personalize
          your experience (such as your default script mood and reminders), to
          communicate with you about your account, and to monitor and improve
          reliability and performance.
        </Section>

        <Section title="4. Sharing of Information">
          We do not sell your personal information. We share data only with
          service providers who help us run the app (such as authentication,
          hosting, and payment processing), and only to the extent needed for
          them to perform those services.
        </Section>

        <Section title="5. Data Retention">
          We retain your information for as long as your account is active or as
          needed to provide the app&apos;s features. You can request deletion of
          your account and associated data at any time from Settings.
        </Section>

        <Section title="6. Your Rights">
          Depending on where you live, you may have rights to access, correct,
          export, or delete your personal information. Contact us using the
          details below to exercise these rights.
        </Section>

        <Section title="7. Contact Us">
          If you have questions about this policy, contact us at
          privacy@example.com. TODO: replace with your real support address.
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

export default PrivacyPolicyScreen;
