import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React from "react";
import { Canvas, Oval } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { fonts } from "@/constants/fonts";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import Section from "./components/section";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useClerk } from "@clerk/expo";
import { useAppStore } from "@/store/auth-store";
import { router } from "expo-router";
import { colord } from "colord";
import { usePreferenceStore } from "@/hooks";

const SCREEN_WIDTH = Dimensions.get("screen").width;

const OVAL_WIDTH = SCREEN_WIDTH * 2;
const OVAL_HEIGHT = OVAL_WIDTH / 2;

const MASCOT_WIDTH = 250;

const ProfileScreen = () => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.97 : 1, { damping: 50 }) },
    ],
    opacity: withTiming(pressed.value ? 0.5 : 1),
  }));

  const { signOut } = useClerk();
  const { clearAppState } = useAppStore();
  const handleSignOut = async () => {
    Alert.alert("Logout", "Are you Sure you want to Logout of the Sailor?", [
      {
        text: "Cancle",
        style: "cancel",
      },
      {
        onPress: async () => {
          try {
            clearAppState();
            await signOut();
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "An error occurred while signing out.");
          }
        },
        text: "Logout",
        style: "destructive",
      },
    ]);
  };

  const appearanceColor = usePreferenceStore(
    (state) => state.preferences.appearance.hex,
  );
  // const appearanceColor = "#6D32BF";

  const backgroundColor = colord(appearanceColor).lighten(0.4).toHex();
  const backCicleColor = colord(appearanceColor).lighten(0.32).toHex();
  const planCardColor = colord(appearanceColor).lighten(0.25).toHex();

  const pillColor = colord(appearanceColor).lighten(0.33).toHex();
  const textColor = colord(appearanceColor)
    .darken(0.2)
    .desaturate(0.35)
    .toHex();

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      <View style={styles.canvasContainer}>
        <Canvas style={styles.canvas}>
          <Oval
            x={SCREEN_WIDTH / 2 - OVAL_WIDTH / 2}
            y={-OVAL_HEIGHT / 3}
            width={OVAL_WIDTH}
            height={OVAL_HEIGHT}
            color={backCicleColor}
          />
        </Canvas>
      </View>
      <Image
        source={require("../../../assets/cloud_mascot.svg")}
        style={styles.mascot}
      />
      <View style={styles.actioncontainer}>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: textColor }]}>Divyanshu</Text>
          <View style={[styles.badgePill, { backgroundColor: pillColor }]}>
            <FontAwesome6
              name="graduation-cap"
              size={16}
              color={textColor}
              iconStyle="solid"
            />
            <Text style={[styles.badgeText, { color: textColor }]}>
              Student
            </Text>
          </View>
        </View>
        <Text style={styles.headerText}>Plan</Text>
        <View style={[styles.planCard, { backgroundColor: planCardColor }]}>
          <View style={styles.planTopRow}>
            <View style={styles.planTitleRow}>
              <FontAwesome6
                name="crown"
                iconStyle="solid"
                size={24}
                color={textColor}
              />
              <Text style={[styles.planTitle, { color: textColor }]}>
                Hestia
              </Text>
            </View>
            <View style={styles.usedRow}>
              <Ionicons name="sparkles-sharp" size={13} color={textColor} />
              <Text style={[styles.usedText, { color: textColor }]}>
                90% used today
              </Text>
            </View>
          </View>

          <View style={styles.planBottomRow}>
            <View
              style={[styles.remainingPill, { backgroundColor: pillColor }]}
            >
              <MaterialDesignIcons name="cards" size={20} color={textColor} />
              <Text style={[styles.remainingText, { color: textColor }]}>
                5 remaining
              </Text>
            </View>
            <Pressable style={styles.manageButton}>
              <Text style={styles.manageButtonText}>Manage</Text>
            </Pressable>
          </View>
        </View>
        <Section style={styles.section}>
          <Section.Row
            icon={<Ionicons name="person" size={22} />}
            iconBgColor={planCardColor}
            label="Edit Profile"
            onPress={() =>
              router.navigate({
                pathname: "/(authenticated)/(tabs)/(profile)/edit-profile",
              })
            }
          />

          <Section.Row
            icon={<Ionicons name="settings-sharp" size={22} />}
            iconBgColor="#d9d9d9"
            label="Settings"
            onPress={() =>
              router.navigate({
                pathname: "/(authenticated)/(tabs)/(profile)/settings",
              })
            }
          />
        </Section>
        <AnimatedPressable
          style={[styles.logoutContainer, animatedStyle]}
          onPress={handleSignOut}
          onPressIn={() => (pressed.value = 1)}
          onPressOut={() => (pressed.value = 0)}
        >
          <Ionicons name="exit-outline" size={28} color={"#E44141"} />
          <Text style={styles.logoutText}>Logout</Text>
        </AnimatedPressable>
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
  canvasContainer: {
    width: "100%",
    height: OVAL_HEIGHT,
  },
  canvas: { flex: 1 },
  mascot: {
    width: MASCOT_WIDTH,
    aspectRatio: 1,
    position: "absolute",
    top: OVAL_HEIGHT / 4.5,
    left: SCREEN_WIDTH / 2 - MASCOT_WIDTH / 2,
    transform: [
      {
        rotate: "15deg",
      },
    ],
  },
  actioncontainer: {
    paddingHorizontal: 20,
    transform: [
      {
        translateY: -90,
      },
    ],
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
  nameContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  headerText: {
    fontSize: 30,
    marginTop: 16,
    fontFamily: fonts.newsreader.regular,
  },
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
    transform: [
      {
        translateX: -6,
      },
    ],
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
    // fontWeight: "600",
    fontFamily: fonts.newsreader.regular,
  },

  logoutText: {
    fontSize: 17,
    color: "#E44141",
  },

  section: {
    marginTop: 30,
  },
  logoutContainer: {
    marginTop: 8,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
  },
});
