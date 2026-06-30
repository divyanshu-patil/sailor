import { Host } from "@expo/ui/swift-ui";
import { Pressable } from "react-native";
import { createAnimatedComponent } from "react-native-reanimated";

export const AnimatedPressable = createAnimatedComponent(Pressable);
export const AnimatedHost = createAnimatedComponent(Host);
