import { StyleSheet, Text } from "react-native";
import EntypoIcons from "@react-native-vector-icons/entypo";
import { colord } from "colord";

import PressableScale from "@/components/ui/animated/PressableScale";

interface CtaButtonProps {
  onPress?: () => void;
  label: string;
  accentColor: string;
}

const CtaButton = ({ accentColor, label, onPress }: CtaButtonProps) => {
  const textLightColor = colord(accentColor).lighten(0.13).toHex();

  return (
    <PressableScale style={[styles.ctaPill]} onPress={onPress}>
      <Text style={[styles.ctaText, { color: textLightColor }]}>{label}</Text>
      <EntypoIcons name="chevron-right" size={54} color={textLightColor} />
    </PressableScale>
  );
};

export default CtaButton;

const styles = StyleSheet.create({
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#414141",
    alignSelf: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  ctaText: {
    fontSize: 36,
    fontFamily: "KronaOne",
  },
});
