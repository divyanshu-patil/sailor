import React from "react";
import { StyleSheet, Text } from "react-native";
import { fonts } from "@/constants/fonts";

interface SectionHeadingProps {
  children: string;
}

/**
 * The "Plan" style section label. Pulled out on its own since it's
 * generic enough to reuse above any future section (e.g. "History",
 * "Achievements") without duplicating the style block.
 */
const SectionHeading = ({ children }: SectionHeadingProps) => (
  <Text style={styles.headerText}>{children}</Text>
);

export default SectionHeading;

const styles = StyleSheet.create({
  headerText: {
    fontSize: 30,
    marginTop: 16,
    fontFamily: fonts.newsreader.regular,
  },
});
