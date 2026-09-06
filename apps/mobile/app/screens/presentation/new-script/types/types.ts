import { Attachment, AUDIENCE_OPTIONS } from "@/types/presentation";
import { ScriptMood } from "@/types/settings/preferences";
import { ExperienceLevel, Profession } from "@/types/user";

export type PresentationFormState = {
  attachments: Attachment[];
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
  // How the script should sound. Seeded from settings when the wizard mounts —
  // see form-context — and overridable for this one script without touching the
  // defaults. `profession` is nullable because a user may never have set one.
  mood: ScriptMood;
  profession: Profession | null;
  experienceLevel: ExperienceLevel;
};

// Labels only — `audienceIndex` indexes into AUDIENCE_OPTIONS, which is what
// script.service maps to the audience value the API expects.
export const AUDIENCES = AUDIENCE_OPTIONS.map((option) => option.label);

// Only the fields with no user-specific default. The voice fields are filled in
// from the stores at mount, so they are not fixed constants — see form-context.
export const DEFAULT_STATE: Omit<
  PresentationFormState,
  "mood" | "profession" | "experienceLevel"
> = {
  attachments: [],
  durationMinutes: 10,
  audienceIndex: 0,
  cardCount: 35,
  description: "",
};
