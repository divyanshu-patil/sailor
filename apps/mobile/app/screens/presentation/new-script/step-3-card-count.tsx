import { Host, Text } from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { usePresentationForm } from "./form-context";
import { View } from "react-native";
import AnimatedSlider from "./components/Slider";
export default function StepCardCount() {
  const { form, setCardCount } = usePresentationForm();

  return (
    <>
      <Host
        modifiers={[animation(Animation.default, form.durationMinutes)]}
        style={{ marginTop: 100 }}
        pointerEvents="none"
      >
        <Text
          modifiers={[
            font({ weight: "semibold", size: 56 }),
            foregroundStyle("#c11b5c"),
            contentTransition("numericText", { countsDown: true }),
            animation(Animation.default, form.cardCount),
            padding({ bottom: 40 }),
          ]}
        >
          {form.cardCount}
        </Text>
      </Host>
      <View
        style={{
          paddingHorizontal: 35,
          alignSelf: "center",
          flex: 1,
          marginTop: 50,
        }}
      >
        <AnimatedSlider
          min={2}
          max={60}
          onChange={(v) => setCardCount(Math.round(v))}
        />
      </View>
    </>
  );
}
