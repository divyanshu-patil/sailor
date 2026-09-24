import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { PROFILE } from "@/screens/profile/theme";

interface HeartMascotProps {
  /** The blob's fill. */
  color?: string;
  /** The heart it is hugging. */
  heart?: string;
  /** The two accent strokes beside the blob. */
  accent?: string;
  /** Rendered width in points; the height follows the 220:210 ratio. */
  size?: number;
}

/**
 * The thank-you blob: a round character hugging a pink heart, arms wrapped
 * around it and a pair of happy closed eyes. Same simple drawn shape as
 * `BlobMascot`, just a different pose for the celebration screen.
 */
const HeartMascot = memo(function HeartMascot({
  color = "#ECEAEE",
  heart = "#F7A8C4",
  accent = PROFILE.accentYellow,
  size = 200,
}: HeartMascotProps) {
  const height = size * (210 / 220);

  return (
    <View pointerEvents="none" style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox="0 0 220 210" fill="none">
        <Rect
          x="14"
          y="62"
          width="7"
          height="20"
          rx="3.5"
          fill={accent}
          transform="rotate(-18 17.5 72)"
        />
        <Rect
          x="199"
          y="62"
          width="7"
          height="20"
          rx="3.5"
          fill={accent}
          transform="rotate(18 202.5 72)"
        />

        <Circle cx="110" cy="96" r="74" fill={color} />

        <Path
          d="M84 88 Q95 76 106 88"
          stroke="#1C1A18"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Path
          d="M114 88 Q125 76 136 88"
          stroke="#1C1A18"
          strokeWidth="8"
          strokeLinecap="round"
        />

        <Path
          d="M110 112 C102 98 82 102 82 120 C82 136 100 146 110 154 C120 146 138 136 138 120 C138 102 118 98 110 112 Z"
          fill={heart}
        />

        <Path
          d="M52 112 C40 134 60 150 86 144"
          stroke="#1C1A18"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <Path
          d="M168 112 C180 134 160 150 134 144"
          stroke="#1C1A18"
          strokeWidth="15"
          strokeLinecap="round"
        />

        <Ellipse cx="86" cy="180" rx="17" ry="10" fill="#1C1A18" />
        <Ellipse cx="134" cy="180" rx="17" ry="10" fill="#1C1A18" />
      </Svg>
    </View>
  );
});

export default HeartMascot;
