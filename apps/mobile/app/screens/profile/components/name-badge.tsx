import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { fonts } from "@/constants/fonts";

interface NameBadgeProps {
  name: string;
  badgeLabel: string;
  pillColor: string;
  textColor: string;
}

/**
 * Dumb presentational piece: the user's display name plus a role pill
 * (e.g. "Student"). No data fetching, no color math — everything comes
 * in as props.
 */
const NameBadge = ({
  name,
  badgeLabel,
  pillColor,
  textColor,
}: NameBadgeProps) => {
  return (
    <View style={styles.nameContainer}>
      <Text style={[styles.name, { color: textColor }]}>{name}</Text>
      <View style={[styles.badgePill, { backgroundColor: pillColor }]}>
        <FontAwesome6
          name="graduation-cap"
          size={16}
          color={textColor}
          iconStyle="solid"
        />
        <Text style={[styles.badgeText, { color: textColor }]}>
          {badgeLabel}
        </Text>
      </View>
    </View>
  );
};

export default NameBadge;

const styles = StyleSheet.create({
  nameContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 36,
    fontFamily: fonts.krona,
    marginTop: 12,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: fonts.amarna.regular,
  },
});
