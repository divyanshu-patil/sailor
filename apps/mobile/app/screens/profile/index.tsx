import React from "react";
import { StyleSheet, View } from "react-native";

import ProfileHeaderArt from "./components/profile-header-art";
import NameBadge from "./components/name-badge";
import SectionHeading from "./components/section-heading";
import PlanCard from "./components/plan-card";
import ProfileMenuSection from "./components/profile-menu-section";
import LogoutButton from "./components/logout-button";
import { useProfileTheme } from "./hooks/use-profile-theme";
import { useLogout } from "./hooks/use-logout";

const ProfileScreen = () => {
  const theme = useProfileTheme();
  const { confirmLogout } = useLogout();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <ProfileHeaderArt backCircleColor={theme.backCircleColor} />

      <View style={styles.actioncontainer}>
        <NameBadge
          name="Divyanshu"
          badgeLabel="Student"
          pillColor={theme.pillColor}
          textColor={theme.textColor}
        />

        <SectionHeading>Plan</SectionHeading>
        <PlanCard
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
