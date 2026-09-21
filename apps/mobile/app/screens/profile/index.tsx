import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import ProfileBackground from "./components/profile-background";
import ProfileHero from "./components/profile-hero";
import FloatingNote from "./components/floating-note";
import SubscriptionCard from "./components/subscription-card";
import { router } from "expo-router";

import SettingsCard from "./components/settings-card";
import LogoutButton from "./components/logout-button";
import { useLogout } from "./hooks/use-logout";
import { PROFILE, profileFonts } from "./theme";
import { BottomTabInset } from "@/constants/theme";
import { useAppUserStore } from "@/store/app-user.store";
import { useUser } from "@/hooks/use-user";
import { useProfileIdentity } from "@/hooks/use-profile-identity";
import { useSubscription } from "@/hooks/use-subscription";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

const ProfileScreen = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { confirmLogout } = useLogout();
  const { isPro, isReady, isRefreshing, plan, openManageMenu } =
    useSubscription();
  const appUser = useAppUserStore((s) => s.appUser);
  const setAppUser = useAppUserStore((s) => s.setAppUser);

  // Clerk owns the profile image; the backend profile supplies the app's
  // display name/email. Kept separate so a backend-name edit can't change a
  // user's generated avatar.
  const identity = useProfileIdentity();

  const { data: profile, isLoading, error, fetchProfile, setData } = useUser();

  // Read as a fallback only — must NOT be a dependency below, or any
  // change to appUser (e.g. going null on cache clear) re-fires this
  // effect against the same stale `profile` and resurrects old data.
  const emailRef = useRef(appUser?.email);
  useEffect(() => {
    emailRef.current = appUser?.email;
  }, [appUser?.email]);

  // Only re-run when a genuinely NEW fetch result comes in. Clerk identity is
  // the fallback for the fields the backend row may not have yet — a consumer
  // backend row starts with `full_name` null, and the name the user signed up
  // with lives in Clerk.
  useEffect(() => {
    if (profile) {
      setAppUser({
        id: profile.id,
        clerkUserId: profile.clerk_user_id,
        email: profile.email || identity.email || emailRef.current || "",
        fullName: profile.full_name || identity.displayName || "",
        nickname: profile.nickname,
        experienceLevel: profile.experience_level,
        profession: profile.profession,
        avatarUrl: profile.avatar_url,
        role: profile.role as "user" | "admin" | "dev",
      });
    }
  }, [profile, identity.displayName, identity.email, setAppUser]);

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

  // One shared value drives every entrance animation, so the whole screen
  // settles in a single coordinated pass instead of each block starting its
  // own timer.
  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0, 0.35],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          entrance.value,
          [0, 0.35],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0.05, 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          entrance.value,
          [0.05, 0.5],
          [0.94, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const planStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0.35, 0.7],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          entrance.value,
          [0.35, 0.7],
          [22, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const settingsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0.5, 0.85],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          entrance.value,
          [0.5, 0.85],
          [22, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const logoutStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0.65, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          entrance.value,
          [0.65, 1],
          [18, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (isLoading && !appUser) {
    return (
      <View style={[styles.root, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={PROFILE.ink} />
        <Text style={styles.stateText}>Getting your profile…</Text>
      </View>
    );
  }

  if (error && !appUser && !identity.isLoaded) {
    return (
      <View style={[styles.root, styles.centered]}>
        <StatusBar style="dark" />
        <Text style={styles.stateTitle}>
          We couldn&apos;t load your profile
        </Text>
        <Text style={styles.stateText}>
          Check your connection and try again.
        </Text>
        <Text
          onPress={fetchProfile}
          accessibilityRole="button"
          style={styles.retry}
        >
          Try again
        </Text>
      </View>
    );
  }

  const displayName =
    appUser?.nickname ||
    appUser?.fullName ||
    identity.displayName ||
    profile?.full_name ||
    "Your profile";
  const displayEmail = identity.email || appUser?.email || profile?.email || "";
  const avatarUrl = identity.imageUrl;

  // The store's own name for the product, so switching monthly to yearly
  // changes the card the moment the new customer info lands. The generic
  // "Pro Plan" is only the fallback for a store that gives no display name.
  const planName = plan ? plan.name : isPro ? "Pro Plan" : "Basic Plan";
  const planDescription = isPro
    ? "Keep creating, you're on a roll!"
    : "Upgrade to unlock the full Sailors experience.";
  const planLoading = !isReady || isRefreshing;
  const statusLabel = plan
    ? plan.expirationDate
      ? `${plan.willRenew ? "Renews" : "Ends"} ${formatDate(plan.expirationDate)}`
      : "Active"
    : isPro
      ? "Active"
      : "Free plan";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Fixed backdrop: lives behind the ScrollView so the shapes hold still
          while the content scrolls over them. */}
      <ProfileBackground
        width={width}
        height={height}
        offsetY={insets.top + 12}
        entrance={entrance}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + BottomTabInset + 40,
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stage}>
          <Animated.View style={[styles.header, headerStyle]}>
            <Text style={styles.heading}>Profile</Text>
            <Text style={styles.subheading}>Your space, your progress.</Text>
          </Animated.View>

          <Animated.View style={[styles.heroStage, heroStyle]}>
            <FloatingNote
              text={"Same you,\nbolder ideas."}
              delay={400}
              style={styles.noteLeft}
            />
            <FloatingNote
              text={"Small steps,\nbig stories."}
              delay={1200}
              style={styles.noteRight}
            />

            <ProfileHero
              name={displayName}
              email={displayEmail}
              avatarUrl={avatarUrl}
              avatarName={identity.name}
              avatarLoading={!identity.isLoaded}
              // Same destination as the "Edit Profile" row below. The photo is
              // what people reach for first, so it should not be the one part
              // of this block that does nothing.
              onAvatarPress={() =>
                router.navigate({
                  pathname: "/(authenticated)/(tabs)/(profile)/edit-profile",
                })
              }
            />
          </Animated.View>

          <Animated.View style={[styles.cardWrap, planStyle]}>
            <SubscriptionCard
              planName={planName}
              description={planDescription}
              statusLabel={statusLabel}
              loading={planLoading}
              onManagePress={openManageMenu}
            />
          </Animated.View>

          <Animated.View style={[styles.cardWrap, settingsStyle]}>
            <SettingsCard />
          </Animated.View>

          <Animated.View style={[styles.cardWrap, logoutStyle]}>
            <LogoutButton onPress={confirmLogout} />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PROFILE.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  stage: {
    position: "relative",
  },
  header: {
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: profileFonts.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: PROFILE.ink,
  },
  subheading: {
    marginTop: 4,
    fontFamily: profileFonts.body,
    fontSize: 15,
    color: PROFILE.muted,
  },
  heroStage: {
    marginTop: 26,
    alignItems: "center",
  },
  noteLeft: {
    left: 14,
    top: 6,
    width: 116,
    transform: [{ rotate: "-6deg" }],
  },
  noteRight: {
    right: 10,
    top: 84,
    width: 116,
    transform: [{ rotate: "6deg" }],
  },
  cardWrap: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  stateTitle: {
    fontFamily: profileFonts.display,
    fontSize: 20,
    color: PROFILE.ink,
    textAlign: "center",
  },
  stateText: {
    fontFamily: profileFonts.body,
    fontSize: 14,
    color: PROFILE.muted,
    textAlign: "center",
  },
  retry: {
    marginTop: 4,
    fontFamily: profileFonts.semibold,
    fontSize: 15,
    color: PROFILE.ink,
  },
});
