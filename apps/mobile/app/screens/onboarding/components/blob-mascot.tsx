import { memo } from "react";
import { View } from "react-native";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";

export type BlobEyes = "open" | "closed" | "squint";

interface BlobMascotProps {
  /** The blob's fill. */
  color: string;
  /** The three accent strokes above the blob. */
  accent: string;
  eyes?: BlobEyes;
  /** Rendered width in points; the height follows the 132:108 ratio. */
  size?: number;
}

/**
 * The little gumdrop character on the onboarding cards: a blob, a pair of eyes
 * and three accent strokes. Drawn directly rather than through `Blobatar`, which
 * seeds a whole face and would not match the reference's simple shape.
 */
const BlobMascot = memo(function BlobMascot({
  color,
  accent,
  eyes = "open",
  size = 132,
}: BlobMascotProps) {
  const height = size * (108 / 132);

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

        {eyes === "open" ? (
          <>
            <Ellipse cx="56" cy="82" rx="6.5" ry="10" fill="#1C1A18" />
            <Ellipse cx="84" cy="82" rx="6.5" ry="10" fill="#1C1A18" />
          </>
        ) : eyes === "closed" ? (
          <>
            <Path
              d="M46 82 Q56 72 66 82"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <Path
              d="M74 82 Q84 72 94 82"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Path
              d="M48 76 L60 84 L48 92"
              stroke="#1C1A18"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M84 76 L72 84 L84 92"
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

export default BlobMascot;
