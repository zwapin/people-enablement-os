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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assessment_questions: {
        Row: {
          correct_index: number
          feedback_correct: string | null
          feedback_wrong: string | null
          id: string
          module_id: string
          options: Json
          order_index: number
          question: string
        }
        Insert: {
          correct_index?: number
          feedback_correct?: string | null
          feedback_wrong?: string | null
          id?: string
          module_id: string
          options?: Json
          order_index?: number
          question: string
        }
        Update: {
          correct_index?: number
          feedback_correct?: string | null
          feedback_wrong?: string | null
          id?: string
          module_id?: string
          options?: Json
          order_index?: number
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          categories: Json | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          status: Database["public"]["Enums"]["module_status"]
          title: string
          track: string
          updated_at: string
        }
        Insert: {
          categories?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["module_status"]
          title: string
          track?: string
          updated_at?: string
        }
        Update: {
          categories?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["module_status"]
          title?: string
          track?: string
          updated_at?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          completed_steps: number | null
          created_at: string | null
          current_step: string | null
          error: string | null
          id: string
          input: Json | null
          job_type: string
          parent_job_id: string | null
          result: Json | null
          status: string
          total_steps: number | null
          updated_at: string | null
        }
        Insert: {
          completed_steps?: number | null
          created_at?: string | null
          current_step?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          job_type: string
          parent_job_id?: string | null
          result?: Json | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_steps?: number | null
          created_at?: string | null
          current_step?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          job_type?: string
          parent_job_id?: string | null
          result?: Json | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          collection_id: string | null
          content: string
          context: string | null
          created_at: string
          file_path: string | null
          id: string
          title: string
        }
        Insert: {
          collection_id?: string | null
          content?: string
          context?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          title: string
        }
        Update: {
          collection_id?: string | null
          content?: string
          context?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_faqs: {
        Row: {
          answer: string
          category: string | null
          collection_id: string | null
          created_at: string
          id: string
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          collection_id?: string | null
          created_at?: string
          id?: string
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          collection_id?: string | null
          created_at?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_faqs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      module_completions: {
        Row: {
          attempts: number
          completed_at: string
          id: string
          module_id: string
          score: number
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string
          id?: string
          module_id: string
          score?: number
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string
          id?: string
          module_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          ai_rationale: string | null
          content_body: string | null
          created_at: string
          curriculum_id: string | null
          id: string
          key_points: Json | null
          order_index: number
          source_document_ids: Json | null
          source_faq_ids: Json | null
          status: Database["public"]["Enums"]["module_status"]
          summary: string | null
          title: string
          track: string
          updated_at: string
        }
        Insert: {
          ai_rationale?: string | null
          content_body?: string | null
          created_at?: string
          curriculum_id?: string | null
          id?: string
          key_points?: Json | null
          order_index?: number
          source_document_ids?: Json | null
          source_faq_ids?: Json | null
          status?: Database["public"]["Enums"]["module_status"]
          summary?: string | null
          title: string
          track?: string
          updated_at?: string
        }
        Update: {
          ai_rationale?: string | null
          content_body?: string | null
          created_at?: string
          curriculum_id?: string | null
          id?: string
          key_points?: Json | null
          order_index?: number
          source_document_ids?: Json | null
          source_faq_ids?: Json | null
          status?: Database["public"]["Enums"]["module_status"]
          summary?: string | null
          title?: string
          track?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_milestones: {
        Row: {
          early_warnings: Json | null
          focus: Json | null
          id: string
          kpis: Json
          label: Database["public"]["Enums"]["milestone_label"]
          obiettivo: string | null
          plan_id: string
        }
        Insert: {
          early_warnings?: Json | null
          focus?: Json | null
          id?: string
          kpis?: Json
          label: Database["public"]["Enums"]["milestone_label"]
          obiettivo?: string | null
          plan_id: string
        }
        Update: {
          early_warnings?: Json | null
          focus?: Json | null
          id?: string
          kpis?: Json
          label?: Database["public"]["Enums"]["milestone_label"]
          obiettivo?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_milestones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_plans: {
        Row: {
          created_at: string
          created_by: string
          id: string
          output_atteso: string | null
          plan_status: Database["public"]["Enums"]["plan_status"]
          premessa: string | null
          rep_id: string
          role_template: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          output_atteso?: string | null
          plan_status?: Database["public"]["Enums"]["plan_status"]
          premessa?: string | null
          rep_id: string
          role_template?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          output_atteso?: string | null
          plan_status?: Database["public"]["Enums"]["plan_status"]
          premessa?: string | null
          rep_id?: string
          role_template?: string | null
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          is_common: boolean | null
          milestone_id: string
          module_id: string | null
          order_index: number | null
          section: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          is_common?: boolean | null
          milestone_id: string
          module_id?: string | null
          order_index?: number | null
          section?: string | null
          title: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          is_common?: boolean | null
          milestone_id?: string
          module_id?: string | null
          order_index?: number | null
          section?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "onboarding_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          id: string
          milestone_label: Database["public"]["Enums"]["milestone_label"]
          order_index: number | null
          section: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_label?: Database["public"]["Enums"]["milestone_label"]
          order_index?: number | null
          section?: string | null
          title: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          created_at?: string
          id?: string
          milestone_label?: Database["public"]["Enums"]["milestone_label"]
          order_index?: number | null
          section?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_role: string | null
          last_activity_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          job_role?: string | null
          last_activity_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_role?: string | null
          last_activity_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rep"
      milestone_label: "30d" | "60d" | "90d"
      module_status: "draft" | "published" | "proposed" | "archived"
      plan_status: "active" | "archived"
      task_type: "module_link" | "activity" | "meeting"
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
      app_role: ["admin", "rep"],
      milestone_label: ["30d", "60d", "90d"],
      module_status: ["draft", "published", "proposed", "archived"],
      plan_status: ["active", "archived"],
      task_type: ["module_link", "activity", "meeting"],
    },
  },
} as const
