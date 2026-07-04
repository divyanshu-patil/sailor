import { fonts } from "@/constants/fonts";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface StatusTextProps {
  labels: string[];
  containerStyles?: ViewStyle | ViewStyle[];
  accentColor: string;
}

const StatusText = ({
  labels,
  containerStyles,
  accentColor,
}: StatusTextProps) => {
  return (
    <View style={[containerStyles]}>
      <Text style={[styles.text, { color: accentColor }]}>
        {"Witch crafting words just\nfor you"}
      </Text>
    </View>
  );
};

export default StatusText;

const styles = StyleSheet.create({
  text: {
    fontSize: 40,
    fontFamily: fonts.krona,
    lineHeight: 60,
  },
});
