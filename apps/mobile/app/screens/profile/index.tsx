import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
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
import { SymbolView } from "expo-symbols";
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

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer}>
        <Canvas style={styles.canvas}>
          <Oval
            x={SCREEN_WIDTH / 2 - OVAL_WIDTH / 2}
            y={-OVAL_HEIGHT / 3}
            width={OVAL_WIDTH}
            height={OVAL_HEIGHT}
            color={"#CDE7FF"}
          />
        </Canvas>
      </View>
      <Image
        source={require("../../../assets/cloud_mascot.svg")}
        style={styles.mascot}
      />
      <View style={styles.actioncontainer}>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>Divyanshu</Text>
          <View style={styles.badgePill}>
            <FontAwesome6
              name="graduation-cap"
              size={16}
              color="#5B7C99"
              iconStyle="solid"
            />
            <Text style={styles.badgeText}>Student</Text>
          </View>
        </View>
        <Text style={styles.headerText}>Plan</Text>
        <View style={styles.planCard}>
          <View style={styles.planTopRow}>
            <View style={styles.planTitleRow}>
              <FontAwesome6
                name="crown"
                iconStyle="solid"
                size={24}
                color="#3B5F7D"
              />
              <Text style={styles.planTitle}>Hestia</Text>
            </View>
            <View style={styles.usedRow}>
              <Ionicons name="sparkles-sharp" size={13} color="#3B5F7D" />
              <Text style={styles.usedText}>90% used today</Text>
            </View>
          </View>

          <View style={styles.planBottomRow}>
            <View style={styles.remainingPill}>
              <MaterialDesignIcons name="cards" size={20} color="#3B5F7D" />
              <Text style={styles.remainingText}>5 remaining</Text>
            </View>
            <Pressable style={styles.manageButton}>
              <Text style={styles.manageButtonText}>Manage</Text>
            </Pressable>
          </View>
        </View>
        <Section style={styles.section}>
          <Section.Row
            icon={<Ionicons name="person" size={22} />}
            iconBgColor="#A9D3F5"
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
    backgroundColor: "#F0F8FF",
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
    color: "#4A7391",
    marginTop: 12,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D9EBF9",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  badgeText: {
    color: "#5B7C99",
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
    backgroundColor: "#A9D3F5",
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
    color: "#3B5F7D",
  },
  usedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  usedText: {
    color: "#3B5F7D",
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
    backgroundColor: "#CDE6FB",
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
    color: "#3B5F7D",
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
    color: "#FFFFFF",
    fontSize: 16,
    // fontWeight: "600",
    fontFamily: fonts.newsreader.regular,
  },
  listCard: {
    width: "88%",
    backgroundColor: "#DCEDFA",
    borderRadius: 16,
    marginTop: 20,
    overflow: "hidden",
  },
  listRow: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#C6DEF0",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  logoutButton: {
    width: "88%",
    backgroundColor: "#F4897E",
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: "center",
    marginTop: 24,
  },
  logoutText: {
    fontSize: 17,
    color: "#E44141",
  },
  homeIndicator: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1F2937",
    marginTop: "auto",
    marginBottom: 8,
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
