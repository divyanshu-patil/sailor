import { View, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import React, { Children, isValidElement, cloneElement } from "react";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { colord } from "colord";
import { fonts } from "@/constants/fonts";
type SectionProps = {
  title?: string;
  footer?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};

type RowProps = {
  icon: React.ReactNode;
  iconBgColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean; // injected by Section, not set manually
};

const Row = ({
  icon: Icon,
  iconBgColor,
  label,
  value,
  onPress,
  showChevron = true,
  isLast,
}: RowProps) => {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <LinearGradient
          colors={[colord(iconBgColor).lighten(0.1).toHex(), iconBgColor]}
          style={styles.iconBadge}
        >
          {Icon}
        </LinearGradient>

        <Text style={styles.label}>{label}</Text>

        <View style={styles.rightContent}>
          {value && <Text style={styles.value}>{value}</Text>}
          {showChevron && (
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          )}
        </View>
      </Pressable>

      {!isLast && <View style={styles.divider} />}
    </>
  );
};

const Section = ({ title, footer, style, children }: SectionProps) => {
  const items = Children.toArray(children);

  return (
    <View style={[styles.wrapper, style]}>
      {title && <Text style={styles.title}>{title.toUpperCase()}</Text>}

      <View style={styles.card}>
        {items.map((child, index) =>
          isValidElement(child)
            ? cloneElement(child as React.ReactElement<RowProps>, {
                isLast: index === items.length - 1,
              })
            : child,
        )}
      </View>

      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
};

Section.Row = Row;

export default Section;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 8,
    marginLeft: 20,
    letterSpacing: 0.2,
  },
  footer: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 8,
    marginLeft: 20,
  },
  card: {
    backgroundColor: "#FFFFFFaa",
    borderRadius: 24,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  rowPressed: {
    backgroundColor: "#EDEDED",
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  label: {
    fontSize: 17,
    color: "#000000",
    flex: 1,
    fontFamily: fonts.amarna.regular,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  value: {
    fontSize: 17,
    color: "#8E8E93",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#C6C6C8",
    marginLeft: 64,
    marginRight: 36,
  },
});
