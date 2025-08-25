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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      batch_run_history: {
        Row: {
          created_at: string
          failed_runs: number
          id: string
          org_id: string
          prompts_processed: number
          run_timestamp: string
          success_rate: number
          successful_prompts: number
          successful_runs: number
          total_provider_runs: number
        }
        Insert: {
          created_at?: string
          failed_runs: number
          id?: string
          org_id: string
          prompts_processed: number
          run_timestamp?: string
          success_rate: number
          successful_prompts: number
          successful_runs: number
          total_provider_runs: number
        }
        Update: {
          created_at?: string
          failed_runs?: number
          id?: string
          org_id?: string
          prompts_processed?: number
          run_timestamp?: string
          success_rate?: number
          successful_prompts?: number
          successful_runs?: number
          total_provider_runs?: number
        }
        Relationships: []
      }
      brand_catalog: {
        Row: {
          average_score: number | null
          first_detected_at: string | null
          id: string
          is_org_brand: boolean
          last_seen_at: string | null
          name: string
          org_id: string
          total_appearances: number | null
          variants_json: Json
        }
        Insert: {
          average_score?: number | null
          first_detected_at?: string | null
          id?: string
          is_org_brand?: boolean
          last_seen_at?: string | null
          name: string
          org_id: string
          total_appearances?: number | null
          variants_json?: Json
        }
        Update: {
          average_score?: number | null
          first_detected_at?: string | null
          id?: string
          is_org_brand?: boolean
          last_seen_at?: string | null
          name?: string
          org_id?: string
          total_appearances?: number | null
          variants_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "brand_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_mentions: {
        Row: {
          average_position: number | null
          competitor_name: string
          created_at: string
          first_seen_at: string
          id: string
          last_seen_at: string
          mention_count: number
          normalized_name: string
          org_id: string
          prompt_id: string
          sentiment: string | null
          updated_at: string
        }
        Insert: {
          average_position?: number | null
          competitor_name: string
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mention_count?: number
          normalized_name: string
          org_id: string
          prompt_id: string
          sentiment?: string | null
          updated_at?: string
        }
        Update: {
          average_position?: number | null
          competitor_name?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mention_count?: number
          normalized_name?: string
          org_id?: string
          prompt_id?: string
          sentiment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_mentions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_mentions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_providers: {
        Row: {
          enabled: boolean
          id: string
          name: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          name: string
        }
        Update: {
          enabled?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      llms_generations: {
        Row: {
          content_extracted: boolean | null
          created_at: string
          generated_at: string
          id: string
          llms_txt_content: string | null
          metadata: Json | null
          org_id: string
          pages_found: number | null
          source: string
        }
        Insert: {
          content_extracted?: boolean | null
          created_at?: string
          generated_at?: string
          id?: string
          llms_txt_content?: string | null
          metadata?: Json | null
          org_id: string
          pages_found?: number | null
          source: string
        }
        Update: {
          content_extracted?: boolean | null
          created_at?: string
          generated_at?: string
          id?: string
          llms_txt_content?: string | null
          metadata?: Json | null
          org_id?: string
          pages_found?: number | null
          source?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          business_city: string | null
          business_country: string | null
          business_description: string | null
          business_state: string | null
          created_at: string
          domain: string
          domain_locked_at: string | null
          domain_verification_method: string | null
          enable_localized_prompts: boolean | null
          id: string
          keywords: string[] | null
          llms_generation_source: string | null
          llms_last_generated_at: string | null
          llms_pages: Json | null
          llms_txt: string | null
          name: string
          plan_tier: string
          products_services: string | null
          subscription_tier: string | null
          target_audience: string | null
        }
        Insert: {
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_state?: string | null
          created_at?: string
          domain: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          enable_localized_prompts?: boolean | null
          id?: string
          keywords?: string[] | null
          llms_generation_source?: string | null
          llms_last_generated_at?: string | null
          llms_pages?: Json | null
          llms_txt?: string | null
          name: string
          plan_tier: string
          products_services?: string | null
          subscription_tier?: string | null
          target_audience?: string | null
        }
        Update: {
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_state?: string | null
          created_at?: string
          domain?: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          enable_localized_prompts?: boolean | null
          id?: string
          keywords?: string[] | null
          llms_generation_source?: string | null
          llms_last_generated_at?: string | null
          llms_pages?: Json | null
          llms_txt?: string | null
          name?: string
          plan_tier?: string
          products_services?: string | null
          subscription_tier?: string | null
          target_audience?: string | null
        }
        Relationships: []
      }
      prompt_provider_responses: {
        Row: {
          brands_json: Json
          competitors_count: number
          competitors_json: Json
          error: string | null
          id: string
          metadata: Json
          model: string | null
          org_brand_present: boolean
          org_brand_prominence: number | null
          org_id: string
          prompt_id: string
          provider: string
          raw_ai_response: string | null
          raw_evidence: string | null
          run_at: string
          score: number
          status: string
          token_in: number
          token_out: number
        }
        Insert: {
          brands_json?: Json
          competitors_count?: number
          competitors_json?: Json
          error?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          org_brand_present?: boolean
          org_brand_prominence?: number | null
          org_id: string
          prompt_id: string
          provider: string
          raw_ai_response?: string | null
          raw_evidence?: string | null
          run_at?: string
          score?: number
          status: string
          token_in?: number
          token_out?: number
        }
        Update: {
          brands_json?: Json
          competitors_count?: number
          competitors_json?: Json
          error?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          org_brand_present?: boolean
          org_brand_prominence?: number | null
          org_id?: string
          prompt_id?: string
          provider?: string
          raw_ai_response?: string | null
          raw_evidence?: string | null
          run_at?: string
          score?: number
          status?: string
          token_in?: number
          token_out?: number
        }
        Relationships: []
      }
      prompts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_id: string
          text: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_id: string
          text: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          prompt_ref: string | null
          rationale: string
          status: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          prompt_ref?: string | null
          rationale: string
          status?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          prompt_ref?: string | null
          rationale?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_prompt_ref_fkey"
            columns: ["prompt_ref"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_state: {
        Row: {
          created_at: string
          id: string
          last_daily_run_at: string | null
          last_daily_run_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_daily_run_at?: string | null
          last_daily_run_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_daily_run_at?: string | null
          last_daily_run_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          payment_collected: boolean | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          payment_collected?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          payment_collected?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscribers_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          subscriber_user_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          subscriber_user_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          subscriber_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      suggested_prompts: {
        Row: {
          accepted: boolean
          created_at: string
          id: string
          org_id: string
          source: string
          text: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          id?: string
          org_id: string
          source: string
          text: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          id?: string
          org_id?: string
          source?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          org_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          org_id: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          org_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      latest_prompt_provider_responses: {
        Row: {
          brands_json: Json | null
          competitors_count: number | null
          competitors_json: Json | null
          error: string | null
          id: string | null
          metadata: Json | null
          model: string | null
          org_brand_present: boolean | null
          org_brand_prominence: number | null
          org_id: string | null
          prompt_id: string | null
          provider: string | null
          raw_ai_response: string | null
          raw_evidence: string | null
          run_at: string | null
          score: number | null
          status: string | null
          token_in: number | null
          token_out: number | null
        }
        Relationships: []
      }
      user_subscription_safe: {
        Row: {
          created_at: string | null
          email: string | null
          payment_status: string | null
          subscribed: boolean | null
          subscription_end: string | null
          subscription_tier: string | null
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          payment_status?: never
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          payment_status?: never
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fix_brand_classification_all_providers: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      fix_hubspot_brand_classification: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      fix_recent_brand_misclassifications: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_prompt_visibility_7d: {
        Args: { requesting_org_id?: string }
        Returns: {
          avg_score_7d: number
          org_id: string
          prompt_id: string
          runs_7d: number
          text: string
        }[]
      }
      get_user_subscription_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          payment_collected: boolean
          subscribed: boolean
          subscription_end: string
          subscription_tier: string
          trial_expires_at: string
        }[]
      }
      reco_upsert: {
        Args: {
          p_citations: Json
          p_cooldown_days?: number
          p_est_lift: number
          p_kind: string
          p_org_id: string
          p_rationale: string
          p_source_prompt_ids: string[]
          p_source_run_ids: string[]
          p_steps: string[]
          p_title: string
        }
        Returns: undefined
      }
      refresh_dashboard_metrics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      test_reco_insert: {
        Args: { p_org_id: string; p_test_title?: string }
        Returns: string
      }
      update_subscriber_safe: {
        Args: {
          p_email: string
          p_payment_collected?: boolean
          p_stripe_customer_id?: string
          p_stripe_subscription_id?: string
          p_subscribed?: boolean
          p_subscription_end?: string
          p_subscription_tier?: string
          p_trial_expires_at?: string
          p_trial_started_at?: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_competitor_brand: {
        Args: { p_brand_name: string; p_org_id: string; p_score?: number }
        Returns: undefined
      }
      upsert_competitor_mention: {
        Args: {
          p_competitor_name: string
          p_normalized_name: string
          p_org_id: string
          p_position?: number
          p_prompt_id: string
          p_sentiment?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
