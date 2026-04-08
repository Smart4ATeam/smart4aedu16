export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          color: string
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          is_global: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          is_global?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          is_global?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          archived: boolean
          conversation_id: string
          id: string
          joined_at: string
          starred: boolean
          unread: boolean
          user_id: string
        }
        Insert: {
          archived?: boolean
          conversation_id: string
          id?: string
          joined_at?: string
          starred?: boolean
          unread?: boolean
          user_id: string
        }
        Update: {
          archived?: boolean
          conversation_id?: string
          id?: string
          joined_at?: string
          starred?: boolean
          unread?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_quizzes: {
        Row: {
          course_id: string
          id: string
          passing_score: number
          questions: Json
          time_limit_minutes: number | null
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          passing_score?: number
          questions?: Json
          time_limit_minutes?: number | null
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          passing_score?: number
          questions?: Json
          time_limit_minutes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          course_id: string
          created_at: string
          end_date: string | null
          id: string
          instructor_id: string | null
          location: string | null
          max_students: number | null
          price: number | null
          recurrence_rule: string | null
          registration_url: string | null
          schedule_type: string
          start_date: string | null
          status: string
          title_suffix: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          max_students?: number | null
          price?: number | null
          recurrence_rule?: string | null
          registration_url?: string | null
          schedule_type?: string
          start_date?: string | null
          status?: string
          title_suffix?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          max_students?: number | null
          price?: number | null
          recurrence_rule?: string | null
          registration_url?: string | null
          schedule_type?: string
          start_date?: string | null
          status?: string
          title_suffix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      course_units: {
        Row: {
          course_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_units_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          course_code: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          detail_url: string | null
          enrollment_points: number
          id: string
          instructor_id: string | null
          long_description: string | null
          materials_url: string | null
          price: number
          registration_url: string | null
          series_id: string | null
          sort_order: number
          status: string
          tags: string[] | null
          title: string
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          course_code?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          detail_url?: string | null
          enrollment_points?: number
          id?: string
          instructor_id?: string | null
          long_description?: string | null
          materials_url?: string | null
          price?: number
          registration_url?: string | null
          series_id?: string | null
          sort_order?: number
          status?: string
          tags?: string[] | null
          title: string
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          course_code?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          detail_url?: string | null
          enrollment_points?: number
          id?: string
          instructor_id?: string | null
          long_description?: string | null
          materials_url?: string | null
          price?: number
          registration_url?: string | null
          series_id?: string | null
          sort_order?: number
          status?: string
          tags?: string[] | null
          title?: string
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          partner_id: string | null
          specialties: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          partner_id?: string | null
          specialties?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          partner_id?: string | null
          specialties?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          category: string
          created_at: string
          description: string
          difficulty: string
          id: string
          sort_order: number
          title: string
          total_steps: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          sort_order?: number
          title: string
          total_steps?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          sort_order?: number
          title?: string
          total_steps?: number
        }
        Relationships: []
      }
      login_tracks: {
        Row: {
          created_at: string
          id: string
          login_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_date?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          community_notify: boolean
          course_reminder: boolean
          deadline_reminder: boolean
          id: string
          show_error: boolean
          show_info: boolean
          show_success: boolean
          show_warning: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          community_notify?: boolean
          course_reminder?: boolean
          deadline_reminder?: boolean
          id?: string
          show_error?: boolean
          show_info?: boolean
          show_success?: boolean
          show_warning?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          community_notify?: boolean
          course_reminder?: boolean
          deadline_reminder?: boolean
          id?: string
          show_error?: boolean
          show_info?: boolean
          show_success?: boolean
          show_warning?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          category: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_end: string | null
          contract_start: string | null
          contract_status: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          revenue_share: number | null
          type: string
          website_url: string | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_status?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          revenue_share?: number | null
          type?: string
          website_url?: string | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_status?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          revenue_share?: number | null
          type?: string
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated: boolean
          ai_api_key: string | null
          ai_provider: string | null
          auto_sync: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          daily_learning_time: string | null
          difficulty_preference: string | null
          display_name: string
          email: string | null
          id: string
          learning_days: number
          learning_goal: string | null
          make_api_token: string | null
          organization_id: string | null
          phone: string | null
          server_location: string | null
          student_id: string | null
          total_badges: number
          total_points: number
          total_revenue: number
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          activated?: boolean
          ai_api_key?: string | null
          ai_provider?: string | null
          auto_sync?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          daily_learning_time?: string | null
          difficulty_preference?: string | null
          display_name?: string
          email?: string | null
          id: string
          learning_days?: number
          learning_goal?: string | null
          make_api_token?: string | null
          organization_id?: string | null
          phone?: string | null
          server_location?: string | null
          student_id?: string | null
          total_badges?: number
          total_points?: number
          total_revenue?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          activated?: boolean
          ai_api_key?: string | null
          ai_provider?: string | null
          auto_sync?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          daily_learning_time?: string | null
          difficulty_preference?: string | null
          display_name?: string
          email?: string | null
          id?: string
          learning_days?: number
          learning_goal?: string | null
          make_api_token?: string | null
          organization_id?: string | null
          phone?: string | null
          server_location?: string | null
          student_id?: string | null
          total_badges?: number
          total_points?: number
          total_revenue?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempted_at: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json
          attempted_at?: string
          id?: string
          passed?: boolean
          quiz_id: string
          score?: number
          user_id: string
        }
        Update: {
          answers?: Json
          attempted_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "course_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_enrollments: {
        Row: {
          certificate: string | null
          checked_in: boolean
          course_id: string | null
          course_type: string | null
          dealer_id: string | null
          enrolled_at: string
          id: string
          invoice_title: string | null
          is_retrain: boolean
          lovable_invite: string | null
          member_id: string | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_status: string | null
          points_awarded: number
          post_survey: string | null
          post_test: string | null
          pre_notification_sent: boolean
          referrer: string | null
          session_date: string | null
          session_id: string | null
          status: string
          test_score: number | null
          user_id: string | null
        }
        Insert: {
          certificate?: string | null
          checked_in?: boolean
          course_id?: string | null
          course_type?: string | null
          dealer_id?: string | null
          enrolled_at?: string
          id?: string
          invoice_title?: string | null
          is_retrain?: boolean
          lovable_invite?: string | null
          member_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          points_awarded?: number
          post_survey?: string | null
          post_test?: string | null
          pre_notification_sent?: boolean
          referrer?: string | null
          session_date?: string | null
          session_id?: string | null
          status?: string
          test_score?: number | null
          user_id?: string | null
        }
        Update: {
          certificate?: string | null
          checked_in?: boolean
          course_id?: string | null
          course_type?: string | null
          dealer_id?: string | null
          enrolled_at?: string
          id?: string
          invoice_title?: string | null
          is_retrain?: boolean
          lovable_invite?: string | null
          member_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          points_awarded?: number
          post_survey?: string | null
          post_test?: string | null
          pre_notification_sent?: boolean
          referrer?: string | null
          session_date?: string | null
          session_id?: string | null
          status?: string
          test_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reg_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "reg_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reg_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_members: {
        Row: {
          course_level: string | null
          created_at: string
          email: string | null
          id: string
          member_no: string | null
          name: string
          notes: string | null
          phone: string | null
          points: number
          referral_code: string | null
          user_id: string | null
        }
        Insert: {
          course_level?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_no?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          points?: number
          referral_code?: string | null
          user_id?: string | null
        }
        Update: {
          course_level?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_no?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          points?: number
          referral_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reg_operation_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          operated_by: string | null
          reason: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          operated_by?: string | null
          reason: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          operated_by?: string | null
          reason?: string
        }
        Relationships: []
      }
      reg_orders: {
        Row: {
          course_ids: string[]
          course_snapshot: Json | null
          created_at: string
          dealer_id: string | null
          discount_plan: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_reissued_at: string | null
          invoice_reissued_number: string | null
          invoice_status: string
          invoice_title: string | null
          invoice_type: string | null
          invoice_void_at: string | null
          invoice_void_reason: string | null
          is_retrain: boolean
          notes: string | null
          order_no: string
          p1_email: string | null
          p1_name: string | null
          p1_phone: string | null
          p2_email: string | null
          p2_name: string | null
          p2_phone: string | null
          p3_email: string | null
          p3_name: string | null
          p3_phone: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          person_count: number
          referrer: string | null
          session_dates: string[]
          tax_id: string | null
          total_amount: number
        }
        Insert: {
          course_ids?: string[]
          course_snapshot?: Json | null
          created_at?: string
          dealer_id?: string | null
          discount_plan?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_reissued_at?: string | null
          invoice_reissued_number?: string | null
          invoice_status?: string
          invoice_title?: string | null
          invoice_type?: string | null
          invoice_void_at?: string | null
          invoice_void_reason?: string | null
          is_retrain?: boolean
          notes?: string | null
          order_no: string
          p1_email?: string | null
          p1_name?: string | null
          p1_phone?: string | null
          p2_email?: string | null
          p2_name?: string | null
          p2_phone?: string | null
          p3_email?: string | null
          p3_name?: string | null
          p3_phone?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          person_count?: number
          referrer?: string | null
          session_dates?: string[]
          tax_id?: string | null
          total_amount?: number
        }
        Update: {
          course_ids?: string[]
          course_snapshot?: Json | null
          created_at?: string
          dealer_id?: string | null
          discount_plan?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_reissued_at?: string | null
          invoice_reissued_number?: string | null
          invoice_status?: string
          invoice_title?: string | null
          invoice_type?: string | null
          invoice_void_at?: string | null
          invoice_void_reason?: string | null
          is_retrain?: boolean
          notes?: string | null
          order_no?: string
          p1_email?: string | null
          p1_name?: string | null
          p1_phone?: string | null
          p2_email?: string | null
          p2_name?: string | null
          p2_phone?: string | null
          p3_email?: string | null
          p3_name?: string | null
          p3_phone?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          person_count?: number
          referrer?: string | null
          session_dates?: string[]
          tax_id?: string | null
          total_amount?: number
        }
        Relationships: []
      }
      reg_point_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          member_id: string
          order_id: string | null
          points_delta: number
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          member_id: string
          order_id?: string | null
          points_delta: number
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          member_id?: string
          order_id?: string | null
          points_delta?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reg_point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "reg_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_point_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reg_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_sub_categories: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      resource_trials: {
        Row: {
          api_key: string | null
          app_id: string
          created_at: string
          id: string
          member_no: string | null
          organization_id: string
          resource_category: string
          resource_id: string
          user_id: string
          webhook_status: string
        }
        Insert: {
          api_key?: string | null
          app_id: string
          created_at?: string
          id?: string
          member_no?: string | null
          organization_id: string
          resource_category: string
          resource_id: string
          user_id: string
          webhook_status?: string
        }
        Update: {
          api_key?: string | null
          app_id?: string
          created_at?: string
          id?: string
          member_no?: string | null
          organization_id?: string
          resource_category?: string
          resource_id?: string
          user_id?: string
          webhook_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_trials_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          app_id: string | null
          author: string | null
          category: string
          created_at: string
          description: string
          detail_url: string | null
          difficulty: string | null
          download_url: string | null
          duration: string | null
          flow_count: number | null
          hot_rank: number | null
          id: string
          industry_tag: string | null
          installs: number
          is_hot: boolean
          rating: number
          sort_order: number
          status: string
          sub_category: string | null
          submitted_by: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          trial_enabled: boolean
          trial_url: string | null
          usage_count: number | null
          version: string | null
          video_type: string | null
        }
        Insert: {
          app_id?: string | null
          author?: string | null
          category?: string
          created_at?: string
          description?: string
          detail_url?: string | null
          difficulty?: string | null
          download_url?: string | null
          duration?: string | null
          flow_count?: number | null
          hot_rank?: number | null
          id?: string
          industry_tag?: string | null
          installs?: number
          is_hot?: boolean
          rating?: number
          sort_order?: number
          status?: string
          sub_category?: string | null
          submitted_by?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          trial_enabled?: boolean
          trial_url?: string | null
          usage_count?: number | null
          version?: string | null
          video_type?: string | null
        }
        Update: {
          app_id?: string | null
          author?: string | null
          category?: string
          created_at?: string
          description?: string
          detail_url?: string | null
          difficulty?: string | null
          download_url?: string | null
          duration?: string | null
          flow_count?: number | null
          hot_rank?: number | null
          id?: string
          industry_tag?: string | null
          installs?: number
          is_hot?: boolean
          rating?: number
          sort_order?: number
          status?: string
          sub_category?: string | null
          submitted_by?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          trial_enabled?: boolean
          trial_url?: string | null
          usage_count?: number | null
          version?: string | null
          video_type?: string | null
        }
        Relationships: []
      }
      revenue_records: {
        Row: {
          amount: number
          description: string | null
          id: string
          recorded_at: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          description?: string | null
          id?: string
          recorded_at?: string
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          recorded_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key_name: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key_name: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key_name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      task_applications: {
        Row: {
          applied_at: string
          completed_at: string | null
          id: string
          reject_reason: string | null
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          completed_at?: string | null
          id?: string
          reject_reason?: string | null
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          applied_at?: string
          completed_at?: string | null
          id?: string
          reject_reason?: string | null
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_applications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string
          difficulty: string
          id: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          difficulty?: string
          id?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          difficulty?: string
          id?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_sections: {
        Row: {
          content_json: Json
          id: string
          sort_order: number
          type: string
          unit_id: string
        }
        Insert: {
          content_json?: Json
          id?: string
          sort_order?: number
          type?: string
          unit_id: string
        }
        Update: {
          content_json?: Json
          id?: string
          sort_order?: number
          type?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_sections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "course_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_learning_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          current_step: number
          id: string
          learning_path_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          current_step?: number
          id?: string
          learning_path_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          current_step?: number
          id?: string
          learning_path_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_progress_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      check_and_grant_achievements: {
        Args: { _user_id: string }
        Returns: undefined
      }
      get_task_application_counts: {
        Args: never
        Returns: {
          count: number
          task_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
