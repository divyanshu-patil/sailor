export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "pro";

export type Profession =
  | 'business'
  | 'tech'
  | 'sales_marketing'
  | 'academic'
  | 'student'
  | 'healthcare'
  | 'finance_consulting'
  | 'legal'
  | 'creative'
  | 'government_nonprofit'
  | 'other';

export const PROFESSION_LABELS: Record<Profession, string> = {
  business: 'Business / Corporate',
  tech: 'Tech / Startup',
  sales_marketing: 'Sales / Marketing',
  academic: 'Academic / Education',
  student: 'Student',
  healthcare: 'Healthcare / Medical',
  finance_consulting: 'Finance / Consulting',
  legal: 'Legal',
  creative: 'Creative / Design',
  government_nonprofit: 'Government / Nonprofit',
  other: 'Other',
};

export const PROFESSIONS: Profession[] = Object.keys(PROFESSION_LABELS) as Profession[];

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string;
  nickname: string;
  experience_level: ExperienceLevel;
  profession: Profession | null;
  avatar_url: string | null;
  role: "user" | "admin";
  /** Server-side completion flags. The account, not the device, is what has
   *  been onboarded — so a reinstall or a second phone does not repeat it. */
  onboarding_completed?: boolean;
  profile_setup_completed?: boolean;
  created_at: string;
}
