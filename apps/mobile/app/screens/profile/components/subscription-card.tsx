import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "../theme";

interface SubscriptionCardProps {
  planName: string;
  description: string;
  statusLabel: string;
  onManagePress: () => void;
}

/**
 * The current plan, rendered from the real RevenueCat entitlement (see
 * useSubscription) rather than a hardcoded name/usage pair. The same tap opens
 * the management sheet for a subscriber and the paywall for everyone else.
 */
const SubscriptionCard = memo(function SubscriptionCard({
  planName,
  description,
  statusLabel,
  onManagePress,
}: SubscriptionCardProps) {
  const squiggle = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(4, 32);
    path.cubicTo(18, 8, 38, 6, 52, 20);
    path.cubicTo(64, 32, 78, 32, 90, 18);
    return path;
  }, []);

  return (
    <View style={styles.card}>
      <Canvas style={styles.squiggle} pointerEvents="none">
        <Path
          path={squiggle}
          style="stroke"
          strokeWidth={4}
          strokeCap="round"
          color="#F4CF66"
        />
      </Canvas>

      <View style={styles.titleRow}>
        <FontAwesome6
          name="crown"
          iconStyle="solid"
          size={22}
          color={PROFILE.ink}
        />
        <Text style={styles.title}>{planName}</Text>
      </View>

      <Text style={styles.description}>{description}</Text>

      <View style={styles.bottomRow}>
        <View style={styles.statusPill}>
          <Ionicons name="sparkles" size={14} color={PROFILE.ink} />
          <Text style={styles.statusText} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>

        <PressableScale
          onPress={onManagePress}
          style={styles.manageButton}
          accessibilityRole="button"
          accessibilityLabel="Manage Plan"
        >
          <Text style={styles.manageLabel}>Manage Plan</Text>
          <Ionicons name="arrow-forward" size={16} color={PROFILE.white} />
        </PressableScale>
      </View>
    </View>
  );
});

export default SubscriptionCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: PROFILE_PASTELS.planCard,
    borderWidth: 1,
    borderColor: PROFILE_PASTELS.planBorder,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: "hidden",
  },
  squiggle: {
    position: "absolute",
    right: 12,
    top: 14,
    width: 94,
    height: 44,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: profileFonts.display,
    fontSize: 24,
    color: PROFILE.ink,
    letterSpacing: -0.4,
  },
  description: {
    marginTop: 4,
    fontFamily: profileFonts.medium,
    fontSize: 14,
    color: "#6F6A73",
  },
  bottomRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,

    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
    flexShrink: 1,
  },
  statusText: {
    fontFamily: profileFonts.medium,
    fontSize: 10,
    color: PROFILE.ink,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
  },
  manageLabel: {
    fontFamily: profileFonts.serif,
    fontSize: 16,
    color: PROFILE.white,
    letterSpacing: -0.2,
  },
});
