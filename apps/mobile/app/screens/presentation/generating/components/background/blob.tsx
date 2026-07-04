import React from "react";
import { Circle } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

type Animatable = number | SharedValue<number>;

interface BlobProps {
  cx: Animatable;
  cy: Animatable;
  r: Animatable;
  color: string;
}

const Blob = ({ cx, cy, r, color }: BlobProps) => {
  return <Circle cx={cx} cy={cy} r={r} color={color} />;
};

export default Blob;
