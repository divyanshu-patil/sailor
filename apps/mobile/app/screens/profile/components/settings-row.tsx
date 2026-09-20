import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons, {
  type IoniconsIconName,
} from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE, profileFonts } from "../theme";

export interface SettingsRowProps {
  icon: IoniconsIconName;
  iconBgColor: string;
  label: string;
  caption?: string;
  isLast?: boolean;
  onPress: () => void;
}

/**
 * One actionable row in the settings card. Press feedback is an opacity fade
 * rather than a scale, so a tapped row doesn't pull itself out of the card.
 */
const SettingsRow = memo(function SettingsRow({
  icon,
  iconBgColor,
  label,
  caption,
  isLast,
  onPress,
}: SettingsRowProps) {
  return (
    <>
      <PressableScale
        onPress={onPress}
        pressedScale={1}
        opacity={{ pressedOpacity: 0.5 }}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[styles.iconBadge, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon} size={20} color={PROFILE.ink} />
        </View>

        <View style={styles.textColumn}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </PressableScale>

      {!isLast && <View style={styles.divider} />}
    </>
  );
});

export default SettingsRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
  },
  label: {
    fontFamily: profileFonts.medium,
    fontSize: 16,
    color: PROFILE.ink,
  },
  caption: {
    marginTop: 2,
    fontFamily: profileFonts.body,
    fontSize: 13,
    color: PROFILE.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EFE3DE",
    marginLeft: 70,
    marginRight: 16,
  },
});
