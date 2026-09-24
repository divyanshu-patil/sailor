import { memo } from "react";
import { View } from "react-native";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";

export type SquareEyes = "open" | "closed" | "squint";

interface SquareMascotProps {
  /** The blob's fill. */
  color: string;
  /** The three accent strokes by the blob's top-left corner. */
  accent: string;
  eyes?: SquareEyes;
  /** Rendered square side in points. */
  size?: number;
}

/**
 * The rounded-square character used on the speaking-profile step.
 *
 * Same idea as `BlobMascot` but the silhouette is a squircle rather than a
 * gumdrop, matching the reference for that screen.
 */
const SquareMascot = memo(function SquareMascot({
  color,
  accent,
  eyes = "open",
  size = 120,
}: SquareMascotProps) {
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 128 128" fill="none">
        <Rect
          x="18"
          y="18"
          width="6"
          height="18"
          rx="3"
          fill={accent}
          transform="rotate(-30 21 27)"
        />
        <Rect
          x="31"
          y="10"
          width="6"
          height="20"
          rx="3"
          fill={accent}
          transform="rotate(-6 34 20)"
        />
        <Rect
          x="45"
          y="15"
          width="6"
          height="18"
          rx="3"
          fill={accent}
          transform="rotate(20 48 24)"
        />

        <Rect x="28" y="28" width="84" height="84" rx="34" fill={color} />

        {eyes === "open" ? (
          <>
            <Ellipse cx="56" cy="70" rx="6" ry="9" fill="#1C1A18" />
            <Ellipse cx="84" cy="70" rx="6" ry="9" fill="#1C1A18" />
          </>
        ) : eyes === "closed" ? (
          <>
            <Path
              d="M46 70 Q56 60 66 70"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <Path
              d="M74 70 Q84 60 94 70"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Path
              d="M48 62 L60 70 L48 78"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M84 62 L72 70 L84 78"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </Svg>
    </View>
  );
});

export default SquareMascot;
