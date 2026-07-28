import { Group, Paint, Blur } from "@shopify/react-native-skia";
import Blob from "./blob";
import { useFloatingValue } from "./hooks/use-floating-value";

export type BlobConfig = {
  color: string;
  r: number;
  startX: number;
  startY: number;
  blendMode?: "screen" | "plus" | "multiply" | "srcOver";
};

interface BlobLayerProps {
  blobs: BlobConfig[];
  width: number;
  height: number;
  blur?: number;
  speed?: number; // 1 = default, 2 = twice as fast, 0.5 = half speed
  minDurationMs?: number;
  maxDurationMs?: number;
  /** false parks the blobs where they are — still drawn, no longer drifting. */
  animate?: boolean;
}

const AnimatedBlob = ({
  color,
  r,
  startX,
  startY,
  blendMode,
  width,
  height,
  speed,
  minDurationMs,
  maxDurationMs,
  animate,
}: BlobConfig & {
  width: number;
  height: number;
  speed: number;
  minDurationMs: number;
  maxDurationMs: number;
  animate: boolean;
}) => {
  const cx = useFloatingValue(
    startX,
    width * 0.05,
    width * 0.95,
    minDurationMs,
    maxDurationMs,
    speed,
    animate,
  );
  const cy = useFloatingValue(
    startY,
    height * 0.05,
    height * 0.95,
    minDurationMs,
    maxDurationMs,
    speed,
    animate,
  );
  const radius = useFloatingValue(
    r,
    r * 0.85,
    r * 1.15,
    minDurationMs * 0.75,
    maxDurationMs * 0.75,
    speed,
    animate,
  );

  const content = <Blob cx={cx} cy={cy} r={radius} color={color} />;

  return blendMode ? <Group blendMode={blendMode}>{content}</Group> : content;
};

const BlobLayer = ({
  blobs,
  width,
  height,
  blur = 100,
  speed = 1,
  minDurationMs = 4000,
  maxDurationMs = 8000,
  animate = true,
}: BlobLayerProps) => {
  return (
    <Group
      layer={
        <Paint>
          <Blur blur={blur} />
        </Paint>
      }
    >
      {blobs.map((blob, i) => (
        <AnimatedBlob
          key={i}
          {...blob}
          width={width}
          height={height}
          speed={speed}
          minDurationMs={minDurationMs}
          maxDurationMs={maxDurationMs}
          animate={animate}
        />
      ))}
    </Group>
  );
};

export default BlobLayer;
