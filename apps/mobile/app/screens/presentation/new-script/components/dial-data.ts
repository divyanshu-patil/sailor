import type { ComponentProps } from "react";
import type Icon from "@react-native-vector-icons/lucide";

import { AUDIENCE_OPTIONS, type AudienceType } from "@/types/presentation";
import { MOOD_OPTIONS, type ScriptMood } from "@/types/settings/preferences";
import { PROFESSIONS, PROFESSION_LABELS, type Profession } from "@/types/user";

type Glyph = ComponentProps<typeof Icon>["name"];

export type DialOption = {
  /** The real name, shown as the title of the focused dial. */
  label: string;
  /** What fits under a 56pt bubble — the arc and the ring use this. */
  short: string;
  /** One line of what the choice does to the script. */
  blurb: string;
  /** Professions and audiences carry an icon; moods carry an emoji. */
  icon?: Glyph;
  emoji?: string;
};

// The labels and the order come from the enums the API already speaks — only
// the icon, the short form and the blurb are new here. A value added to
// PROFESSIONS or AUDIENCE_OPTIONS shows up on the dial with no work; only its
// metadata has to be filled in below.

const PROFESSION_META: Record<
  Profession,
  Omit<DialOption, "label" | "emoji"> & { icon: Glyph }
> = {
  business: {
    short: "Business",
    blurb: "Corporate framing, outcomes first",
    icon: "briefcase",
  },
  tech: {
    short: "Tech",
    blurb: "Product-minded and plain about detail",
    icon: "laptop",
  },
  sales_marketing: {
    short: "Sales",
    blurb: "Persuasive, warm and benefit-led",
    icon: "megaphone",
  },
  academic: {
    short: "Academic",
    blurb: "Structured, evidenced and precise",
    icon: "graduation-cap",
  },
  student: {
    short: "Student",
    blurb: "Curious, clear and easy to follow",
    icon: "book-open",
  },
  healthcare: {
    short: "Health",
    blurb: "Careful, factual and reassuring",
    icon: "stethoscope",
  },
  finance_consulting: {
    short: "Finance",
    blurb: "Analytical, measured and specific",
    icon: "trending-up",
  },
  legal: {
    short: "Legal",
    blurb: "Exact, careful and qualified",
    icon: "scale",
  },
  creative: {
    short: "Creative",
    blurb: "Expressive, visual and story-first",
    icon: "palette",
  },
  government_nonprofit: {
    short: "Public",
    blurb: "Plain-spoken, civic and inclusive",
    icon: "landmark",
  },
  other: {
    short: "Other",
    blurb: "A neutral voice with no field jargon",
    icon: "user",
  },
};

const MOOD_META: Record<ScriptMood, Omit<DialOption, "label" | "icon">> = {
  confident: {
    short: "Confident",
    blurb: "Assured, direct and self-possessed",
    emoji: "😎",
  },
  calm: {
    short: "Calm",
    blurb: "Clear, composed and thoughtful",
    emoji: "😌",
  },
  playful: {
    short: "Playful",
    blurb: "Light, warm and quick to smile",
    emoji: "😄",
  },
  reflective: {
    short: "Reflective",
    blurb: "Considered, honest and unhurried",
    emoji: "🤔",
  },
  energetic: {
    short: "Energetic",
    blurb: "Fast, bright and full of momentum",
    emoji: "⚡",
  },
};

const AUDIENCE_META: Record<
  AudienceType,
  Omit<DialOption, "label" | "emoji"> & { icon: Glyph }
> = {
  general: {
    short: "General",
    blurb: "Everyone in the room, no jargon",
    icon: "users",
  },
  executives: {
    short: "Execs",
    blurb: "Decisions first, detail on request",
    icon: "briefcase",
  },
  students: {
    short: "Students",
    blurb: "A teaching tone with worked examples",
    icon: "graduation-cap",
  },
  technical: {
    short: "Technical",
    blurb: "Depth, trade-offs and specifics",
    icon: "code",
  },
  business: {
    short: "Sales",
    blurb: "Value, positioning and impact",
    icon: "megaphone",
  },
  educational: {
    short: "Classroom",
    blurb: "Paced for learning, built on examples",
    icon: "book-open",
  },
  investors: {
    short: "Investors",
    blurb: "Traction, market and the ask",
    icon: "trending-up",
  },
};

export const PROFESSION_DIAL: DialOption[] = PROFESSIONS.map((p) => ({
  label: PROFESSION_LABELS[p],
  ...PROFESSION_META[p],
}));

export const MOOD_DIAL: DialOption[] = MOOD_OPTIONS.map((m) => ({
  label: m.label,
  ...MOOD_META[m.tag],
}));

export const AUDIENCE_DIAL: DialOption[] = AUDIENCE_OPTIONS.map((a) => ({
  label: a.label,
  ...AUDIENCE_META[a.value],
}));
