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
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      batch_jobs: {
        Row: {
          cancellation_requested: boolean
          completed_at: string | null
          completed_tasks: number
          created_at: string
          failed_tasks: number
          id: string
          last_heartbeat: string | null
          metadata: Json | null
          org_id: string
          runner_id: string | null
          started_at: string | null
          status: string
          total_tasks: number
        }
        Insert: {
          cancellation_requested?: boolean
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          failed_tasks?: number
          id?: string
          last_heartbeat?: string | null
          metadata?: Json | null
          org_id: string
          runner_id?: string | null
          started_at?: string | null
          status?: string
          total_tasks?: number
        }
        Update: {
          cancellation_requested?: boolean
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          failed_tasks?: number
          id?: string
          last_heartbeat?: string | null
          metadata?: Json | null
          org_id?: string
          runner_id?: string | null
          started_at?: string | null
          status?: string
          total_tasks?: number
        }
        Relationships: []
      }
      batch_tasks: {
        Row: {
          attempts: number
          batch_job_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          prompt_id: string
          provider: string
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          batch_job_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          prompt_id: string
          provider: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          batch_job_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          prompt_id?: string
          provider?: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_tasks_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_candidates: {
        Row: {
          candidate_name: string
          confidence_score: number
          created_at: string
          detection_count: number
          first_detected_at: string
          id: string
          last_detected_at: string
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_name: string
          confidence_score?: number
          created_at?: string
          detection_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_name?: string
          confidence_score?: number
          created_at?: string
          detection_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
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
      daily_usage: {
        Row: {
          created_at: string
          date: string
          id: string
          org_id: string
          prompts_used: number
          providers_used: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          org_id: string
          prompts_used?: number
          providers_used?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          org_id?: string
          prompts_used?: number
          providers_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean
          flag_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          flag_name: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          flag_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
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
          competitors: string[] | null
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
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_state?: string | null
          competitors?: string[] | null
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
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_state?: string | null
          competitors?: string[] | null
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
          verification_token?: string | null
          verified_at?: string | null
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
        ]
      }
      scheduler_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          result: Json | null
          run_key: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          result?: Json | null
          run_key: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          result?: Json | null
          run_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      scheduler_state: {
        Row: {
          created_at: string | null
          id: string
          last_daily_run_at: string | null
          last_daily_run_key: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          last_daily_run_at?: string | null
          last_daily_run_key?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_daily_run_at?: string | null
          last_daily_run_key?: string | null
          updated_at?: string | null
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
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          processed?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_brand_candidate: {
        Args: { p_candidate_id: string; p_candidate_name: string }
        Returns: undefined
      }
      cancel_active_batch_jobs: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: Json
      }
      claim_batch_tasks: {
        Args: { p_job_id: string; p_limit?: number; p_max_attempts?: number }
        Returns: {
          attempts: number
          batch_job_id: string
          id: string
          prompt_id: string
          provider: string
        }[]
      }
      clean_competitor_catalog: {
        Args: { p_dry_run?: boolean }
        Returns: Json
      }
      cleanup_old_scheduler_runs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
      fix_stuck_batch_jobs: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_verification_token: {
        Args: { org_id: string }
        Returns: string
      }
      get_brand_candidates_for_org: {
        Args: Record<PropertyKey, never>
        Returns: {
          candidate_name: string
          detection_count: number
          first_detected_at: string
          id: string
          last_detected_at: string
          status: string
        }[]
      }
      get_cron_secret: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_daily_usage: {
        Args: { p_date?: string; p_org_id: string }
        Returns: {
          prompts_used: number
          providers_used: number
        }[]
      }
      get_feature_flag: {
        Args: { flag_name: string }
        Returns: boolean
      }
      get_latest_prompt_provider_responses: {
        Args: { p_org_id?: string; p_prompt_id?: string }
        Returns: {
          brands_json: Json
          competitors_count: number
          competitors_json: Json
          error: string
          id: string
          metadata: Json
          model: string
          org_brand_present: boolean
          org_brand_prominence: number
          org_id: string
          prompt_id: string
          provider: string
          raw_ai_response: string
          raw_evidence: string
          run_at: string
          score: number
          status: string
          token_in: number
          token_out: number
        }[]
      }
      get_latest_prompt_provider_responses_catalog_only: {
        Args: { p_org_id?: string; p_prompt_id?: string }
        Returns: {
          brands_json: Json
          competitors_count: number
          competitors_json: Json
          error: string
          id: string
          metadata: Json
          model: string
          org_brand_present: boolean
          org_brand_prominence: number
          org_id: string
          prompt_id: string
          provider: string
          raw_ai_response: string
          raw_evidence: string
          run_at: string
          score: number
          status: string
          token_in: number
          token_out: number
        }[]
      }
      get_org_competitor_summary: {
        Args: { p_days?: number; p_org_id?: string }
        Returns: {
          avg_score: number
          competitor_name: string
          distinct_prompts: number
          first_seen: string
          last_seen: string
          total_mentions: number
        }[]
      }
      get_prompt_competitors: {
        Args: { p_days?: number; p_prompt_id: string }
        Returns: {
          competitor_name: string
          mentions: number
          share: number
        }[]
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
      get_unified_dashboard_data: {
        Args: { p_org_id?: string }
        Returns: Json
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
      increment_completed_tasks: {
        Args: { job_id: string }
        Returns: undefined
      }
      increment_daily_usage: {
        Args: {
          p_date?: string
          p_org_id: string
          p_prompts_increment?: number
          p_providers_increment?: number
        }
        Returns: Json
      }
      increment_failed_tasks: {
        Args: { job_id: string }
        Returns: undefined
      }
      mark_domain_verified: {
        Args: { org_id: string }
        Returns: boolean
      }
      rebuild_competitors_catalog_only: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      reject_brand_candidate: {
        Args: { p_candidate_id: string }
        Returns: undefined
      }
      resume_stuck_batch_job: {
        Args: { p_job_id: string }
        Returns: Json
      }
      test_reco_insert: {
        Args: { p_org_id: string; p_test_title?: string }
        Returns: string
      }
      try_mark_daily_run: {
        Args: { p_today_key: string }
        Returns: Json
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
      upsert_prompt_provider_response: {
        Args: {
          p_brands_json?: Json
          p_competitors_count?: number
          p_competitors_json?: Json
          p_error?: string
          p_metadata?: Json
          p_model?: string
          p_org_brand_present?: boolean
          p_org_brand_prominence?: number
          p_org_id: string
          p_prompt_id: string
          p_provider: string
          p_raw_ai_response?: string
          p_raw_evidence?: string
          p_score?: number
          p_status?: string
          p_token_in?: number
          p_token_out?: number
        }
        Returns: string
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
