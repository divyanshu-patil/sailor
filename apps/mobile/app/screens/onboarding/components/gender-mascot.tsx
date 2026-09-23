import { memo } from "react";
import { View } from "react-native";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";

export type GenderMascotVariant = "male" | "female" | "neutral";

/** The accent strokes above the blob, per card. */
const ACCENTS: Record<GenderMascotVariant, string> = {
  male: "#6D8BEA",
  female: "#F27CA0",
  neutral: "#5FC79A",
};

interface GenderMascotProps {
  /** The blob's fill. */
  color: string;
  variant: GenderMascotVariant;
  /** Rendered width in points; the height follows the 132:108 ratio. */
  size?: number;
}

/**
 * The little gumdrop character on each gender card: a blob, a pair of eyes and
 * three accent strokes. Female gets the closed, happy eyes; the others get the
 * round ones. Drawn directly rather than through `Blobatar`, which seeds a
 * whole face and would not match the reference's simple shape.
 */
const GenderMascot = memo(function GenderMascot({
  color,
  variant,
  size = 132,
}: GenderMascotProps) {
  const height = size * (108 / 132);
  const accent = ACCENTS[variant];
  const closedEyes = variant === "female";

  return (
    <View pointerEvents="none" style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox="0 0 132 108" fill="none">
        <Rect
          x="38"
          y="16"
          width="6"
          height="20"
          rx="3"
          fill={accent}
          transform="rotate(-24 41 26)"
        />
        <Rect x="56" y="10" width="6" height="22" rx="3" fill={accent} />
        <Rect
          x="74"
          y="16"
          width="6"
          height="20"
          rx="3"
          fill={accent}
          transform="rotate(24 77 26)"
        />

        <Path d="M18 108 C2 70 30 22 66 22 C102 22 130 70 114 108 Z" fill={color} />

        {closedEyes ? (
          <>
            <Path
              d="M46 80 Q56 70 66 80"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <Path
              d="M74 80 Q84 70 94 80"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Ellipse cx="56" cy="82" rx="6.5" ry="10" fill="#1C1A18" />
            <Ellipse cx="84" cy="82" rx="6.5" ry="10" fill="#1C1A18" />
          </>
        )}
      </Svg>
    </View>
  );
});

export default GenderMascot;
