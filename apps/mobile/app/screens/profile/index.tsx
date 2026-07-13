import React from "react";
import { Alert, StyleSheet, View } from "react-native";

import ProfileHeaderArt from "./components/profile-header-art";
import NameBadge from "./components/name-badge";
import SectionHeading from "./components/section-heading";
import PlanCard from "./components/plan-card";
import ProfileMenuSection from "./components/profile-menu-section";
import LogoutButton from "./components/logout-button";
import { useProfileTheme } from "./hooks/use-profile-theme";
import { useLogout } from "./hooks/use-logout";
import { PROFESSION_LABELS } from "@/types/user";
import { PROFESSION_ICONS } from "./components/profession-icons";
import { useAppUserStore } from "@/store/app-user.store";

const ProfileScreen = () => {
  const theme = useProfileTheme();
  const { confirmLogout } = useLogout();
  const appUser = useAppUserStore((s) => s.appUser);
  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <ProfileHeaderArt backCircleColor={theme.backCircleColor} />

      <View style={styles.actioncontainer}>
        <NameBadge
          name={appUser?.nickname.toUpperCase() ?? "NoName"}
          badgeLabel={PROFESSION_LABELS[appUser?.profession ?? "student"]}
          badgeIcon={PROFESSION_ICONS[appUser?.profession ?? "student"]}
          pillColor={theme.pillColor}
          textColor={theme.textColor}
        />

        <SectionHeading>Plan</SectionHeading>
        <PlanCard
          onManagePress={() =>
            Alert.alert("Coming soon", "Manage subscriptions is coming soon")
          }
          planName="Hestia"
          usagePercent={90}
          remainingCount={5}
          cardColor={theme.planCardColor}
          pillColor={theme.pillColor}
          textColor={theme.textColor}
        />

        <ProfileMenuSection
          planCardColor={theme.planCardColor}
          style={styles.section}
        />

        <LogoutButton onPress={confirmLogout} />
      </View>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "visible",
  },
  actioncontainer: {
    paddingHorizontal: 20,
    transform: [{ translateY: -90 }],
  },
  section: {
    marginTop: 30,
  },
});
