import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6, {
  FontAwesome6SolidIconName,
} from "@react-native-vector-icons/fontawesome6";
import { fonts } from "@/constants/fonts";

interface NameBadgeProps {
  name: string;
  badgeLabel: string;
  badgeIcon: FontAwesome6SolidIconName;
  pillColor: string;
  textColor: string;
}

const NameBadge = ({
  name,
  badgeLabel,
  badgeIcon,
  pillColor,
  textColor,
}: NameBadgeProps) => {
  return (
    <View style={styles.nameContainer}>
      <Text numberOfLines={1} style={[styles.name, { color: textColor }]}>
        {name}
      </Text>
      <View style={[styles.badgePill, { backgroundColor: pillColor }]}>
        <FontAwesome6
          name={badgeIcon}
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
