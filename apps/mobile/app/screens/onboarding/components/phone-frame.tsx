import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { PROFILE, profileFonts } from "@/screens/profile/theme";

interface PhoneFrameProps {
  /** Rendered width in points; the visible height follows at 1.42:1. */
  width: number;
  /** Laid over the lock screen, a third of the way down — the notification. */
  children?: ReactNode;
}

const BEZEL = "#F2E9DE";
const BEZEL_EDGE = "#E6DACB";

/**
 * The top of a phone on its lock screen, dissolving into the page.
 *
 * Only the top ~two thirds is drawn: the bottom fades into the onboarding
 * ground, so the phone reads as an illustration of "your lock screen" rather
 * than a device render competing with the heading under it. Everything is
 * proportional to `width`, so it scales with the screen and never with fixed
 * point values that only look right on one device.
 */
const PhoneFrame = memo(function PhoneFrame({
  width,
  children,
}: PhoneFrameProps) {
  const height = width * 1.42;
  const radius = width * 0.2;
  const bezel = Math.max(5, width * 0.026);
  const scale = width / 230;

  return (
    <View pointerEvents="none" style={{ width, height }}>
      {/* Side buttons, behind the bezel so only their edges show. */}
      <View
        style={[
          styles.button,
          { left: -2.5 * scale, top: height * 0.24, height: height * 0.09 },
        ]}
      />
      <View
        style={[
          styles.button,
          { left: -2.5 * scale, top: height * 0.36, height: height * 0.09 },
        ]}
      />
      <View
        style={[
          styles.button,
          { right: -2.5 * scale, top: height * 0.3, height: height * 0.14 },
        ]}
      />

      <View style={[styles.bezel, { borderRadius: radius, padding: bezel }]}>
        <View style={[styles.screen, { borderRadius: radius - bezel }]}>
          {/* The wallpaper: a blue sky from the top right and a green wash
              from the left, as two radial glows over white — radial so they
              blend like a mesh instead of meeting at a straight seam. */}
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 100 142"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient
                id="sky"
                cx="78"
                cy="-6"
                r="104"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#0B4FEA" />
                <Stop offset="0.4" stopColor="#2F7CF5" />
                <Stop offset="0.72" stopColor="#8EC0F8" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient
                id="leaf"
                cx="4"
                cy="64"
                r="62"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#12A150" />
                <Stop offset="0.42" stopColor="#34B874" stopOpacity="0.85" />
                <Stop offset="1" stopColor="#7CD3A4" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100" height="142" fill="#FFFFFF" />
            <Rect width="100" height="142" fill="url(#sky)" />
            <Rect width="100" height="142" fill="url(#leaf)" />
          </Svg>
          <LinearGradient
            colors={[
              "rgba(250,252,255,0)",
              "rgba(250,252,255,0.85)",
              "#FAFCFF",
            ]}
            locations={[0.55, 0.82, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* A soft glare across the glass. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={[
              styles.statusBar,
              { paddingHorizontal: 22 * scale, paddingTop: 13 * scale },
            ]}
          >
            <Text style={[styles.time, { fontSize: 14.5 * scale }]}>9:41</Text>
            <View
              style={[
                styles.island,
                {
                  width: 64 * scale,
                  height: 19 * scale,
                  marginTop: -1 * scale,
                },
              ]}
            />
            <View style={[styles.icons, { gap: 4 * scale }]}>
              <Ionicons name="cellular" size={12 * scale} color="#FFFFFF" />
              <Ionicons name="wifi" size={13 * scale} color="#FFFFFF" />
              <Ionicons name="battery-full" size={19 * scale} color="#FFFFFF" />
            </View>
          </View>

          {children ? (
            <View
              style={[
                styles.slot,
                { top: height * 0.34, paddingHorizontal: 9 * scale },
              ]}
            >
              {children}
            </View>
          ) : null}
        </View>
      </View>

      {/* The dissolve. Wider than the phone so the bezel's shadow fades too. */}
      <LinearGradient
        colors={[
          "rgba(251,243,234,0)",
          "rgba(251,243,234,0.75)",
          PROFILE.background,
        ]}
        locations={[0, 0.6, 1]}
        style={[styles.fade, { height: height * 0.3 }]}
      />
    </View>
  );
});

export default PhoneFrame;

const styles = StyleSheet.create({
  bezel: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BEZEL,
    borderWidth: 1,
    borderColor: BEZEL_EDGE,
    shadowColor: "#8A6A45",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  button: {
    position: "absolute",
    width: 5,
    borderRadius: 3,
    backgroundColor: BEZEL_EDGE,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontFamily: profileFonts.semibold,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  island: {
    borderRadius: 999,
    backgroundColor: "#0B0B0D",
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
  },
  slot: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  fade: {
    position: "absolute",
    left: -30,
    right: -30,
    bottom: -2,
  },
});
