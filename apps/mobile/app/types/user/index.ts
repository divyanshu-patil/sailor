export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "pro";
export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string;
  nickname: string;
  experience_level: ExperienceLevel;
  avatar_url: string | null;
  role: "user" | "admin";
  created_at: string;
}
