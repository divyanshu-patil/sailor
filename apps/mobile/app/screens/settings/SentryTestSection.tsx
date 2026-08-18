import React from "react";
import { Section, Button } from "@expo/ui/swift-ui";
import * as Sentry from "@sentry/react-native";

/**
 * Dev-only smoke test for the Sentry wiring. Rendered behind `__DEV__` in
 * settings/index.tsx, so it is stripped from release bundles.
 *
 * "Captured error" goes through captureException (should appear in Sentry
 * within a few seconds); "Crash the screen" throws during render, which is the
 * only one of the two that also proves Sentry.wrap's error boundary is live.
 */
export function SentryTestSection({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const [crash, setCrash] = React.useState(false);

  if (crash) {
    throw new Error("Sentry test: render crash");
  }

  return (
    <Section title="Sentry (dev only)">
      <Button
        onPress={() => {
          const id = Sentry.captureException(
            new Error("Sentry test: captured error"),
          );
          onMessage(`Sent to Sentry. Event id: ${id}`);
        }}
        label="Send captured error"
      />
      <Button
        label="Crash the screen"
        role="destructive"
        onPress={() => setCrash(true)}
      />
    </Section>
  );
}
