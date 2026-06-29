import { fonts } from "@/constants/fonts";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";
import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Dimensions.get("window").width;
export const RETURN_START_X = SCREEN_WIDTH * 1.5;
export const VISIBLE_COUNT = 4;

export const digitModifiers = (animationId: number): ModifierConfig[] => [
  contentTransition("numericText", { countsDown: true }),
  animation(Animation.spring({ bounce: 0.25 }), animationId),
  font({ family: fonts.krona }),
  foregroundStyle("#d9d9d9"),
];

export const separatorModifiers: ModifierConfig[] = [
  font({ family: fonts.krona }),
  foregroundStyle("#d9d9d9"),
];

export const staticModifiers: ModifierConfig[] = [
  font({ family: fonts.krona }),
  foregroundStyle("#d9d9d9"),
];
