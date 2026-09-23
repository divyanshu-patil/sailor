import { type ReactNode, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import OrganicBlob from "@/components/ui/organic-blob";
import { PROFILE, PROFILE_PASTELS } from "@/screens/profile/theme";
import OnboardingProgress from "./onboarding-progress";

/** The soft organic shapes behind every step — the app's shared warm ground. */
function OnboardingBackdrop() {
  const { width, height } = useWindowDimensions();
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 900 });
  }, [reveal]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <OrganicBlob
        seed="onboarding-sun"
        width={width * 0.7}
        height={width * 0.7}
        color="#FBEBCB"
        x={width * 0.55}
        y={-width * 0.28}
        opacity={0.9}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="onboarding-pink"
        width={width * 0.6}
        height={height * 0.42}
        color={PROFILE_PASTELS.pinkSoft}
        x={-width * 0.38}
        y={height * 0.5}
        opacity={0.8}
        complexity={5}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="onboarding-mint"
        width={width * 0.95}
        height={height * 0.46}
        color="#DCEFE0"
        x={width * 0.25}
        y={height * 0.7}
        opacity={0.8}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
    </View>
  );
}

interface OnboardingScreenProps {
  progress: number;
  /**
   * First step has no back button by design — only the progress bar. Future
   * steps opt in; `onBack` moves the persisted position, it never discards
   * answers.
   */
  showBack?: boolean;
  onBack?: () => void;
  /** Pinned above the home indicator; lifted by the keyboard. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The shell every onboarding step renders inside: background, safe areas, the
 * top progress row, a scrollable body and a pinned footer. One copy so ten
 * steps don't each re-derive spacing and insets.
 */
export default function OnboardingScreen({
  progress,
  showBack = false,
  onBack,
  footer,
  children,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <OnboardingBackdrop />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 10,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            {showBack ? (
              <PressableScale
                onPress={onBack}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={22} color={PROFILE.ink} />
              </PressableScale>
            ) : null}
            <View style={styles.progressWrap}>
              <OnboardingProgress progress={progress} />
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PROFILE.background },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PROFILE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: { flex: 1 },
  scrollBody: { flexGrow: 1 },
  footer: { paddingTop: 12 },
});
