import { fonts } from "@/constants/fonts";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { TextMorph } from "../../../../components/text-morph";
import Animated, { LinearTransition } from "react-native-reanimated";

interface StatusTextProps {
  labels: string[];
  containerStyles?: ViewStyle | ViewStyle[];
  accentColor: string;
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
  accentColor,
  interval = 2000,
  fontSize = 40,
}: StatusTextProps) => {
  // working copy that gets reshuffled every full cycle
  const [orderedLabels, setOrderedLabels] = useState(labels);
  const [statusText, setStatusText] = useState(orderedLabels[0]);
  const [currentIndex, setCurrentIndex] = useState(1);

  // Keep orderedLabels in sync when the `labels` prop changes.
  //
  // Compared by content, not identity: this resets state, so an unmemoised
  // array from the caller would reset -> re-render -> new array -> reset,
  // forever. Content comparison makes the component safe to call either way.
  const labelsKey = labels.join("\u0000");
  const labelsKeyRef = useRef(labelsKey);
  useEffect(() => {
    if (labelsKeyRef.current !== labelsKey) {
      labelsKeyRef.current = labelsKey;
      setOrderedLabels(labels);
      setCurrentIndex(1);
      setStatusText(labels[0]);
    }
    // `labels` is intentionally not a dep — `labelsKey` stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey]);

  useEffect(() => {
    // Nothing to rotate through — this is the completed/failed case, where the
    // single label is the deck title. Skip the interval rather than reshuffle
    // a one-item array every tick.
    if (orderedLabels.length <= 1) return;

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
    <Animated.View
      style={[styles.container, containerStyles]}
      layout={LinearTransition.springify()}
    >
      <TextMorph text={statusText} color={accentColor} fontSize={fontSize} />
    </Animated.View>
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
