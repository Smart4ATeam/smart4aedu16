export type RecipientMode = "all" | "specific" | "filter";

export interface RecipientFilter {
  mode: RecipientMode;
  user_ids?: string[];
  member_ids?: string[];
  filters?: {
    course_ids?: string[];
    course_ids_all?: string[];
    session_ids?: string[];
    session_date_from?: string;
    session_date_to?: string;
    enrollment_status?: string[];
    course_category?: string[];
    exclude_user_ids?: string[];
  };
}

export interface PreviewRecipient {
  user_id: string;
  name: string;
  email: string | null;
  member_no: string | null;
}

export interface PreviewResult {
  total: number;
  sample: PreviewRecipient[];
  preview: PreviewRecipient[];
}
