import { memo, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

import PressableScale from "@/components/ui/animated/PressableScale";
import ShimmerBar from "@/components/ui/shared/shimmer-bar";
import ShimmerOverlay from "@/components/ui/shared/shimmer-overlay";
import { fonts } from "@/constants/fonts";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "../theme";

/** Fixed, so the skeleton and the real pill occupy the same box. */
const STATUS_PILL_HEIGHT = 32;

interface SubscriptionCardProps {
  planName: string;
  /** "Monthly", "Annual" — the billing period, when the store names one. The
   *  plan names say nothing about how often they bill, so this does. */
  periodLabel?: string | null;
  description: string;
  statusLabel: string;
  /** Sweep a sheen across the plan name. On for a paid plan. */
  shimmerName?: boolean;
  /**
   * A customer-info read is in flight, so what the store knows about the plan
   * is not final yet. The pill becomes a skeleton and the button a spinner
   * rather than showing a stale plan as though it were confirmed — the app
   * re-reads RevenueCat on every foreground, so this is also what the user
   * sees for the first moment after coming back from the store's own sheet.
   */
  loading?: boolean;
  onManagePress: () => void;
}

/**
 * The current plan, rendered from the real RevenueCat entitlement (see
 * useSubscription) rather than a hardcoded name/usage pair. The same tap opens
 * the management sheet for a subscriber and the paywall for everyone else.
 */
const SubscriptionCard = memo(function SubscriptionCard({
  planName,
  periodLabel,
  description,
  statusLabel,
  shimmerName = false,
  loading = false,
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
        {/* A sheen across the name itself, masked to the glyphs. Only for a
            paid plan — shimmering "Basic" would be selling the thing they
            already declined. */}
        {shimmerName ? (
          <ShimmerOverlay baseColor={PROFILE.ink} highlightColor="#C9A227">
            <Text style={styles.title} numberOfLines={1}>
              {planName}
            </Text>
          </ShimmerOverlay>
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {planName}
          </Text>
        )}

        {periodLabel ? (
          <View style={styles.periodChip}>
            <Text style={styles.periodText}>{periodLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.description}>{description}</Text>

      <View style={styles.bottomRow}>
        {loading ? (
          // Same box as the real pill, so the row does not resize when the
          // status lands.
          <View
            style={[styles.statusPill, styles.statusSkeleton]}
            accessibilityRole="progressbar"
            accessibilityLabel="Checking your subscription"
          >
            <ShimmerBar
              height={STATUS_PILL_HEIGHT}
              color={PROFILE_PASTELS.planBorder}
              highlightColor="rgba(255,255,255,0.9)"
              duration={1200}
            />
          </View>
        ) : (
          <View style={styles.statusPill}>
            <Ionicons name="sparkles" size={14} color={PROFILE.ink} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        )}

        <PressableScale
          onPress={onManagePress}
          // A tap mid-read would open the paywall or the manage menu on an
          // entitlement we are in the middle of replacing.
          disabled={loading}
          style={styles.manageButton}
          accessibilityRole="button"
          accessibilityLabel="Manage Plan"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={PROFILE.white} />
          ) : (
            <>
              <Text style={styles.manageLabel}>Manage Plan</Text>
              <Ionicons name="arrow-forward" size={16} color={PROFILE.white} />
            </>
          )}
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
    // The squiggle lives in the top-right corner; the name stops before it
    // rather than running under it.
    paddingRight: 96,
  },
  title: {
    // Krona: the plan's name is the one piece of branding on this card, and
    // it is the face the deck titles already use.
    fontFamily: fonts.krona,
    fontSize: 19,
    lineHeight: 26,
    color: PROFILE.ink,
    letterSpacing: -0.4,
  },
  periodChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  periodText: {
    fontFamily: profileFonts.semibold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: "#6F6A73",
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
    gap: 5,
    paddingHorizontal: 11,
    height: STATUS_PILL_HEIGHT,

    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
    flexShrink: 1,
  },
  statusSkeleton: {
    // The shimmer fills the pill edge to edge, so the padding and the row
    // direction belong to the content it stands in for — in a row the bar
    // would size to its (zero) content instead of to the pill.
    flexDirection: "column",
    alignItems: "stretch",
    paddingHorizontal: 0,
    overflow: "hidden",
    width: 112,
    flexShrink: 0,
    backgroundColor: PROFILE_PASTELS.planBorder,
  },
  statusText: {
    fontFamily: profileFonts.medium,
    fontSize: 10,
    color: PROFILE.ink,
    flexShrink: 1,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // Holds its size while the spinner is in it. Without this the button
    // collapsed to a disc on every foreground refresh and sprang back. Kept
    // as tight as the label allows: the status beside it is the part that
    // runs out of room, and "Renews today at 1:10 PM" is a long sentence.
    minWidth: 150,
    paddingHorizontal: 20,
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
