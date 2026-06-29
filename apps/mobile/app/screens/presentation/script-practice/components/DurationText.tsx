import { Host, HStack, Text as SwiftUIText } from "@expo/ui/swift-ui";
import { Animation, animation } from "@expo/ui/swift-ui/modifiers";
import {
  digitModifiers,
  separatorModifiers,
  staticModifiers,
} from "../constants";

interface DurationInfo {
  minutesTens: number;
  minutesOnes: number;
  secsTens: number;
  secsOnes: number;
}

interface DurationTextProps {
  currentIndex: number;
  durationInfo: DurationInfo;
  playbackPosition: number;
  recordingDuration: string | null;
}

const DurationText = ({
  currentIndex,
  durationInfo,
  playbackPosition,
  recordingDuration,
}: DurationTextProps) => {
  const { minutesTens, minutesOnes, secsTens, secsOnes } = durationInfo;

  const playbackMinutesTens = Math.floor(
    Math.floor(playbackPosition / 60) / 10,
  );
  const playbackMinutesOnes = Math.floor(playbackPosition / 60) % 10;
  const playbackSecsTens = Math.floor((playbackPosition % 60) / 10);
  const playbackSecsOnes = Math.floor(playbackPosition % 60) % 10;

  return (
    <Host
      matchContents
      modifiers={[animation(Animation.spring({ bounce: 0.25 }), currentIndex)]}
    >
      <HStack spacing={0}>
        {recordingDuration ? (
          // Playback mode: "01:23 / 02:47"
          <>
            <SwiftUIText modifiers={digitModifiers(playbackMinutesTens)}>
              {String(playbackMinutesTens)}
            </SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(playbackMinutesOnes)}>
              {String(playbackMinutesOnes)}
            </SwiftUIText>
            <SwiftUIText modifiers={separatorModifiers}>:</SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(playbackSecsTens)}>
              {String(playbackSecsTens)}
            </SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(playbackSecsOnes)}>
              {String(playbackSecsOnes)}
            </SwiftUIText>

            <SwiftUIText modifiers={separatorModifiers}> / </SwiftUIText>

            {/* Total duration — static, no transition needed */}
            <SwiftUIText modifiers={staticModifiers}>
              {recordingDuration}
            </SwiftUIText>
          </>
        ) : (
          // Recording mode: "01:47"
          <>
            <SwiftUIText modifiers={digitModifiers(Number(minutesTens))}>
              {minutesTens}
            </SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(Number(minutesOnes))}>
              {minutesOnes}
            </SwiftUIText>
            <SwiftUIText modifiers={separatorModifiers}>:</SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(Number(secsTens))}>
              {secsTens}
            </SwiftUIText>
            <SwiftUIText modifiers={digitModifiers(Number(secsOnes))}>
              {secsOnes}
            </SwiftUIText>
          </>
        )}
      </HStack>
    </Host>
  );
};

export default DurationText;
