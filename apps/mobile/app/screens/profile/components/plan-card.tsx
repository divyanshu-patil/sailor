// components/ui/PlanCard.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { fonts } from "@/constants/fonts";
import PressableScale from "@/components/ui/animated/PressableScale";
import ShimmerOverlay from "@/components/ui/shared/shimmer-overlay";
import { colord } from "colord";

interface PlanCardProps {
  planName: string;
  usagePercent: number;
  remainingCount: number;
  cardColor: string;
  pillColor: string;
  textColor: string;
  onManagePress?: () => void;
}

const PlanCard = ({
  planName,
  usagePercent,
  remainingCount,
  cardColor,
  pillColor,
  textColor,
  onManagePress,
}: PlanCardProps) => {
  return (
    <PressableScale
      onPress={onManagePress}
      style={[styles.planCard, { backgroundColor: cardColor }]}
    >
      <View style={styles.planTopRow}>
        <ShimmerOverlay
          baseColor={textColor}
          highlightColor={colord(textColor).lighten(0.25).toHex()}
          duration={3000}
        >
          <View style={styles.planTitleRow}>
            <FontAwesome6
              name="crown"
              iconStyle="solid"
              size={24}
              color={textColor}
            />
            <Text style={[styles.planTitle, { color: textColor }]}>
              {planName}
            </Text>
          </View>
        </ShimmerOverlay>

        <View style={styles.usedRow}>
          <Ionicons name="sparkles-sharp" size={13} color={textColor} />
          <Text style={[styles.usedText, { color: textColor }]}>
            {usagePercent}% used today
          </Text>
        </View>
      </View>

      <View style={styles.planBottomRow}>
        <View style={[styles.remainingPill, { backgroundColor: pillColor }]}>
          <MaterialDesignIcons name="cards" size={20} color={textColor} />
          <Text style={[styles.remainingText, { color: textColor }]}>
            {remainingCount} remaining
          </Text>
        </View>
        <PressableScale style={styles.manageButton} onPress={onManagePress}>
          <Text style={styles.manageButtonText}>Manage</Text>
        </PressableScale>
      </View>
    </PressableScale>
  );
};

export default PlanCard;

const styles = StyleSheet.create({
  planCard: {
    width: "100%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  planTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planTitle: {
    fontSize: 28,
    fontFamily: fonts.krona,
    fontWeight: "700",
  },
  usedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  usedText: {
    fontSize: 14,
    fontFamily: fonts.amarna.regular,
  },
  planBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 30,
    gap: 20,
  },
  remainingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    transform: [{ translateX: -6 }],
  },
  remainingText: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: fonts.newsreader.regular,
  },
  manageButton: {
    backgroundColor: "#2B2B2B",
    flex: 1,
    paddingVertical: 20,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  manageButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: fonts.newsreader.regular,
  },
});
