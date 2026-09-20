import { frame, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { ExperienceLevel, PROFESSION_LABELS, PROFESSIONS } from "@/types/user";

export const EXPERIENCE_LEVELS: { tag: ExperienceLevel; label: string }[] = [
  { tag: "beginner", label: "Beginner" },
  { tag: "intermediate", label: "Intermediate" },
  { tag: "advanced", label: "Advanced" },
  { tag: "pro", label: "Pro speaker" },
];

export { PROFESSION_LABELS, PROFESSIONS };

const ROW_LABEL_BASE_MODIFIERS = [
  foregroundStyle({
    type: "hierarchical" as const,
    style: "secondary" as const,
  }),
];

export function rowLabelModifiers(withPicker?: boolean) {
  return [
    ...ROW_LABEL_BASE_MODIFIERS,
    frame({
      maxWidth: withPicker ? Infinity : 92,
      alignment: "leading" as const,
    }),
  ];
}
