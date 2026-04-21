import type { Tables, Enums } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type UserRole = { user_id: string; role: Enums<"app_role"> };
export type LearningProgress = Tables<"user_learning_progress"> & { learning_paths?: { title: string } | null };

export interface StudentDetail {
  profile: Profile;
  roles: UserRole[];
  progress: LearningProgress[];
  memberPoints?: number;
  memberTaskPoints?: number;
}
