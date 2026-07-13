import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
// NOTE: adjust this import to wherever Section actually lives in your
// project — it was previously co-located with the profile screen route
// file via a relative "./components/section" import.
import Section from "./section";

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  iconBgColor: string;
  label: string;
  onPress: () => void;
}

interface ProfileMenuSectionProps {
  planCardColor: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The list of navigable profile menu rows (Edit Profile, Settings, ...).
 * Turning this into a data array means adding a new row later (e.g.
 * "Subscription", "Help") is a one-line addition, not a JSX edit.
 */
const ProfileMenuSection = ({
  planCardColor,
  style,
}: ProfileMenuSectionProps) => {
  const items: MenuItem[] = [
    {
      key: "edit-profile",
      icon: <Ionicons name="person" size={22} />,
      iconBgColor: planCardColor,
      label: "Edit Profile",
      onPress: () =>
        router.navigate({
          pathname: "/(authenticated)/(tabs)/(profile)/edit-profile",
        }),
    },
    {
      key: "settings",
      icon: <Ionicons name="settings-sharp" size={22} />,
      iconBgColor: "#d9d9d9",
      label: "Settings",
      onPress: () =>
        router.navigate({
          pathname: "/(authenticated)/(tabs)/(profile)/settings",
        }),
    },
  ];

  return (
    <Section style={style}>
      {items.map((item) => (
        <Section.Row
          key={item.key}
          icon={item.icon}
          iconBgColor={item.iconBgColor}
          label={item.label}
          onPress={item.onPress}
        />
      ))}
    </Section>
  );
};

export default ProfileMenuSection;
