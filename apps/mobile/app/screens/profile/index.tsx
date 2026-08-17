import React, { useEffect, useRef } from "react";
import { StyleSheet, View, ActivityIndicator, Text } from "react-native";

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
import { useUser } from "@/hooks/use-user";
import { useSubscription } from "@/hooks/use-subscription";

const ProfileScreen = () => {
  const theme = useProfileTheme();
  const { confirmLogout } = useLogout();
  const { isPro, openCustomerCenter, openPaywall } = useSubscription();
  const appUser = useAppUserStore((s) => s.appUser);
  const setAppUser = useAppUserStore((s) => s.setAppUser);

  const { data: profile, isLoading, error, fetchProfile, setData } = useUser();

  // Read as a fallback only — must NOT be a dependency below, or any
  // change to appUser (e.g. going null on cache clear) re-fires this
  // effect against the same stale `profile` and resurrects old data.
  const emailRef = useRef(appUser?.email);
  useEffect(() => {
    emailRef.current = appUser?.email;
  }, [appUser?.email]);

  // Only re-run when a genuinely NEW fetch result comes in.
  useEffect(() => {
    if (profile) {
      setAppUser({
        id: profile.id,
        clerkUserId: profile.clerk_user_id,
        email: profile.email || emailRef.current || "",
        fullName: profile.full_name,
        nickname: profile.nickname,
        experienceLevel: profile.experience_level,
        profession: profile.profession,
        avatarUrl: profile.avatar_url,
        role: profile.role as "user" | "admin" | "dev",
      });
    }
  }, [profile, setAppUser]);

  // appUser null means: cache was just cleared, or we've (re)mounted after
  // that clear. `data` in useUser can still be holding the pre-clear
  // profile though, so drop it explicitly first — otherwise the effect
  // above just puts the stale profile straight back. Only once data is
  // actually gone do we kick off a real fetch.
  useEffect(() => {
    if (!appUser) {
      if (profile) {
        setData(() => undefined);
        return;
      }
      if (!isLoading && !error) {
        fetchProfile();
      }
    }
  }, [appUser, profile, isLoading, error, setData, fetchProfile]);

  if (isLoading && !appUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text>Getting your profile</Text>
      </View>
    );
  }

  if (error && !appUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Failed to fetch data</Text>
        <Text onPress={fetchProfile} style={styles.retry}>
          Retry
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <ProfileHeaderArt backCircleColor={theme.backCircleColor} />

      <View style={styles.actioncontainer}>
        <NameBadge
          name={appUser?.nickname?.toUpperCase() ?? "NoName"}
          badgeLabel={PROFESSION_LABELS[appUser?.profession ?? "student"]}
          badgeIcon={PROFESSION_ICONS[appUser?.profession ?? "student"]}
          pillColor={theme.pillColor}
          textColor={theme.textColor}
        />

        <SectionHeading>Plan</SectionHeading>
        {/* One button, two jobs, decided by entitlement: a subscriber gets the
            Customer Center (cancel, change plan, refund, restore — all of it
            native and dashboard-configured), everyone else gets the paywall.
            Sending a subscriber to a paywall is how apps get "I already paid"
            support mail. */}
        <PlanCard
          onManagePress={isPro ? openCustomerCenter : openPaywall}
          planName={isPro ? "Pro" : "Basic"}
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  actioncontainer: {
    paddingHorizontal: 20,
    transform: [{ translateY: -90 }],
  },
  section: {
    marginTop: 30,
  },
  retry: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
