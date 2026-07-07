import { fonts } from "@/constants/fonts";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { TextMorph } from "./text-morph";

interface StatusTextProps {
  labels: string[];
  containerStyles?: ViewStyle | ViewStyle[];
  accentColors: string[];
  interval?: number;
  fontSize?: number;
}

const LINE_HEIGHT = 50;

// Fisher-Yates shuffle, returns a new array
const shuffle = (arr: string[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const StatusText = ({
  labels,
  containerStyles,
  accentColors,
  interval = 2000,
  fontSize = 40,
}: StatusTextProps) => {
  // working copy that gets reshuffled every full cycle
  const [orderedLabels, setOrderedLabels] = useState(labels);
  const [statusText, setStatusText] = useState(orderedLabels[0]);
  const [currentIndex, setCurrentIndex] = useState(1);

  // keep orderedLabels in sync if the `labels` prop itself changes
  const labelsRef = useRef(labels);
  useEffect(() => {
    if (labelsRef.current !== labels) {
      labelsRef.current = labels;
      setOrderedLabels(labels);
      setCurrentIndex(1);
      setStatusText(labels[0]);
    }
  }, [labels]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const nextIndex = currentIndex % orderedLabels.length;

      // completed a full pass — reshuffle before showing the next one
      if (nextIndex === 0) {
        const reshuffled = shuffle(orderedLabels);
        setOrderedLabels(reshuffled);
        setStatusText(reshuffled[0]);
        setCurrentIndex(1);
        return;
      }

      setStatusText(orderedLabels[nextIndex]);
      setCurrentIndex((prev) => prev + 1);
    }, interval);

    return () => clearInterval(intervalId);
  }, [currentIndex, interval, orderedLabels]);

  return (
    // <Host matchContents style={[styles.container, containerStyles]}>
    //   <Text
    //     modifiers={[
    //       contentTransition("numericText", { countsDown: true }),
    //       animation(Animation.default, currentIndex),
    //       font({ family: fonts.krona, size: 40 }),
    //       foregroundStyle(accentColors[0]),
    //       frame({
    //         width: Dimensions.get("screen").width - 40,
    //         height: LINE_HEIGHT * maxLines,
    //         alignment: "topLeading",
    //       }),
    //     ]}
    //   >
    //     {statusText}
    //   </Text>
    // </Host>
    <View style={[styles.container, containerStyles]}>
      <TextMorph
        text={statusText}
        color={accentColors[0]}
        fontSize={fontSize}
      />
    </View>
  );
};

export default StatusText;

const styles = StyleSheet.create({
  container: { alignSelf: "flex-start" },
  text: {
    fontSize: 40,
    fontFamily: fonts.krona,
    lineHeight: LINE_HEIGHT,
  },
});
