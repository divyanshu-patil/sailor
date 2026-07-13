import type { Profession } from "@/types/user";
import { FontAwesome6SolidIconName } from "@react-native-vector-icons/fontawesome6";

export const PROFESSION_ICONS: Record<Profession, FontAwesome6SolidIconName> = {
  business: "briefcase",
  tech: "laptop-code",
  sales_marketing: "bullhorn",
  academic: "chalkboard-user",
  student: "graduation-cap",
  healthcare: "stethoscope",
  finance_consulting: "chart-line",
  legal: "scale-balanced",
  creative: "palette",
  government_nonprofit: "landmark",
  other: "user",
};
