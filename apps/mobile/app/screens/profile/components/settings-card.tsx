import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { type IoniconsIconName } from "@react-native-vector-icons/ionicons";

import { PROFILE, PROFILE_PASTELS } from "../theme";
import SettingsRow from "./settings-row";

interface MenuItem {
  key: string;
  icon: IoniconsIconName;
  iconBgColor: string;
  label: string;
  caption: string;
  pathname:
    | "/(authenticated)/(tabs)/(profile)/edit-profile"
    | "/(authenticated)/(tabs)/(profile)/settings"
    | "/(authenticated)/(tabs)/(profile)/terms-of-service"
    | "/(authenticated)/(tabs)/(profile)/privacy-policy";
}

/**
 * Account actions, mapped to the routes the profile stack actually has. Every
 * destination here exists — the app has no standalone Notifications or Help
 * screens, and those settings live inside Settings rather than behind their own
 * row.
 */
const ITEMS: MenuItem[] = [
  {
    key: "account",
    icon: "person-outline",
    iconBgColor: PROFILE_PASTELS.blue,
    label: "Account Information",
    caption: "Nickname, avatar & speaking profile",
    pathname: "/(authenticated)/(tabs)/(profile)/edit-profile",
  },
  {
    key: "preferences",
    icon: "options-outline",
    iconBgColor: PROFILE_PASTELS.yellow,
    label: "Preferences",
    caption: "Practice reminders & defaults",
    pathname: "/(authenticated)/(tabs)/(profile)/settings",
  },
  {
    key: "terms",
    icon: "document-text-outline",
    iconBgColor: PROFILE_PASTELS.mint,
    label: "Terms of Service",
    caption: "How Sailors works",
    pathname: "/(authenticated)/(tabs)/(profile)/terms-of-service",
  },
  {
    key: "privacy",
    icon: "shield-checkmark-outline",
    iconBgColor: PROFILE_PASTELS.purple,
    label: "Privacy Policy",
    caption: "What we store, and why",
    pathname: "/(authenticated)/(tabs)/(profile)/privacy-policy",
  },
];

const SettingsCard = memo(function SettingsCard() {
  return (
    <View style={styles.card}>
      {ITEMS.map((item, index) => (
        <SettingsRow
          key={item.key}
          icon={item.icon}
          iconBgColor={item.iconBgColor}
          label={item.label}
          caption={item.caption}
          isLast={index === ITEMS.length - 1}
          onPress={() => router.navigate({ pathname: item.pathname })}
        />
      ))}
    </View>
  );
});

export default SettingsCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: PROFILE.white,
    borderRadius: 26,
    paddingVertical: 6,
    overflow: "hidden",
  },
});
