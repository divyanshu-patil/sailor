import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Icon from "@react-native-vector-icons/lucide";

import PressableScale from "@/components/ui/animated/PressableScale";
import { HandwrittenNote } from "@/components/ui/handwritten-note";
import { useSubscription } from "@/hooks/use-subscription";
import { formatRenewal } from "@/utils/format-renewal";
import { BottomBlobs } from "@/screens/streak-restore/scenes";
import { restoreColors, restoreFonts } from "@/screens/streak-restore/theme";
import { CancelScene } from "./scene";

/**
 * "Cancel Subscription?"
 *
 * Neither store lets an app cancel on a user's behalf — the most any app can
 * do is open the store's own sheet. So this screen is the part that is ours:
 * the moment to say what cancelling costs and what it doesn't, before the
 * platform UI takes over. The manage menu used to go straight to that sheet,
 * which gave nobody a chance to change their mind.
 *
 * Built out of the restore flow's pieces — the same cream, the same doodled
 * asides, the same character with the broken heart — because it is the same
 * conversation: something is about to be lost, and it can be undone.
 */

const C = restoreColors.ask;
/** The destructive accent. Only the button and its sparks carry it — the page
 *  is not trying to frighten anyone out of a decision they already made. */
const DANGER = "#F2705E";

/** Short strokes flanking the button, positioned against its own box. */
const SPARKS = [
  { side: "left", out: 28, top: -2, rotate: "-38deg", h: 20 },
  { side: "left", out: 42, top: 26, rotate: "-4deg", h: 18 },
  { side: "left", out: 30, top: 52, rotate: "32deg", h: 16 },
  { side: "right", out: 28, top: -2, rotate: "38deg", h: 20 },
  { side: "right", out: 42, top: 26, rotate: "4deg", h: 18 },
  { side: "right", out: 30, top: 52, rotate: "-32deg", h: 16 },
] as const;

export default function CancelSubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { plan, manageSubscription } = useSubscription();
  const [busy, setBusy] = useState(false);

  const onCancel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    // Opens the store's subscription sheet and re-reads customer info on the
    // way back, cache bypassed — so the profile card behind this screen is
    // already right by the time it is visible again.
    await manageSubscription();
    setBusy(false);
    router.back();
  }, [busy, manageSubscription, router]);

  // What they actually keep. A subscription cancelled today runs to the end of
  // the period it was paid for, and saying so is the honest version of "you'll
  // lose access" — most cancel screens leave people thinking it stops now.
  const untilLine = plan?.expirationDate
    ? `You'll keep Pro until ${formatRenewal(plan.expirationDate, true)}, then lose access to premium features.`
    : "You'll lose access to premium features at the end of your billing period.";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <HandwrittenNote
        lines={["Sad to", "see you go..."]}
        arrowSize={46}
        color={C.note}
        fontSize={15}
        style={{ left: 16, top: insets.top + 44 }}
      />
      <HandwrittenNote
        lines={["It's okay!", "You can always", "come back."]}
        arrowSize={46}
        color={C.note}
        fontSize={15}
        flip
        style={{ right: 16, top: insets.top + 34 }}
      />

      <View style={styles.bottomBlobs} pointerEvents="none">
        <BottomBlobs width={W} height={W * 0.47} />
      </View>

      {/* Scene and copy in flow, the same stage-then-footer shape the restore
          screen settled on — it is what keeps the two from overlapping on a
          short phone. */}
      <View style={[styles.stage, { paddingTop: insets.top + 96 }]}>
        <View pointerEvents="none">
          <CancelScene width={W} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Cancel{"\n"}Subscription?</Text>
          <Text style={styles.blurb}>{untilLine}</Text>
        </View>
      </View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 34 }]}
      >
        <View style={styles.buttonRow}>
          {SPARKS.map((spark, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.spark,
                {
                  height: spark.h,
                  backgroundColor: DANGER,
                  top: spark.top,
                  transform: [{ rotate: spark.rotate }],
                  ...(spark.side === "left"
                    ? { left: -spark.out }
                    : { right: -spark.out }),
                },
              ]}
            />
          ))}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Cancel subscription"
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onCancel}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color={C.buttonInk} />
            ) : (
              <Icon name="trash-2" size={22} color={DANGER} />
            )}
            <Text style={styles.ctaLabel}>Cancel Subscription</Text>
          </PressableScale>
        </View>

        <PressableScale
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={styles.keep}>Keep Subscription</Text>
        </PressableScale>
      </View>

      <HandwrittenNote
        lines={["Same you,", "brighter days", "ahead."]}
        arrowSize={38}
        color={C.note}
        fontSize={13}
        style={{ left: 12, bottom: insets.bottom + 152 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bottomBlobs: { position: "absolute", left: 0, right: 0, bottom: 0 },

  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 20,
  },
  copy: {
    alignSelf: "stretch",
    paddingHorizontal: 40,
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: restoreFonts.display,
    fontSize: 40,
    lineHeight: 45,
    textAlign: "center",
    letterSpacing: -1,
    color: C.ink,
  },
  blurb: {
    fontFamily: restoreFonts.regular,
    fontSize: 16.5,
    lineHeight: 23,
    textAlign: "center",
    color: C.body,
  },

  footer: { alignItems: "center", gap: 16, paddingTop: 8 },
  buttonRow: { alignItems: "center", justifyContent: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 64,
    paddingHorizontal: 30,
    minWidth: 268,
    borderRadius: 32,
    backgroundColor: C.button,
  },
  ctaLabel: {
    fontFamily: restoreFonts.bold,
    fontSize: 19,
    color: C.buttonInk,
  },
  keep: { fontFamily: restoreFonts.semiBold, fontSize: 16, color: C.body },
  spark: { position: "absolute", width: 6, borderRadius: 3 },
});
