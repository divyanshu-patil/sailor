import { frame, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { ExperienceLevel } from "@/types/user";

export const EXPERIENCE_LEVELS: { tag: ExperienceLevel; label: string }[] = [
  { tag: "beginner", label: "Beginner" },
  { tag: "intermediate", label: "Intermediate" },
  { tag: "advanced", label: "Advanced" },
  { tag: "pro", label: "Pro speaker" },
];

export const DESTRUCTIVE_RED = "#FF3B30"; // iOS system red

export const ROW_LABEL_MODIFIERS = [
  frame({ width: 92, alignment: "leading" as const }),
  foregroundStyle({
    type: "hierarchical" as const,
    style: "secondary" as const,
  }),
];
