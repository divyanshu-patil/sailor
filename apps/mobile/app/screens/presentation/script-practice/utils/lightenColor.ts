import { colord } from "colord";

export const lightenColor = (hex: string, threshold = 0.15) =>
  colord(hex).lighten(threshold).toHex();
