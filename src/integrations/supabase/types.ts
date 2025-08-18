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
      organizations: {
        Row: {
          business_description: string | null
          created_at: string
          domain: string
          domain_locked_at: string | null
          domain_verification_method: string | null
          id: string
          keywords: string[] | null
          name: string
          plan_tier: string
          products_services: string | null
          target_audience: string | null
        }
        Insert: {
          business_description?: string | null
          created_at?: string
          domain: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          id?: string
          keywords?: string[] | null
          name: string
          plan_tier: string
          products_services?: string | null
          target_audience?: string | null
        }
        Update: {
          business_description?: string | null
          created_at?: string
          domain?: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          id?: string
          keywords?: string[] | null
          name?: string
          plan_tier?: string
          products_services?: string | null
          target_audience?: string | null
        }
        Relationships: []
      }
      prompt_runs: {
        Row: {
          brands: Json | null
          citations: Json | null
          competitors: Json | null
          cost_est: number
          id: string
          prompt_id: string
          provider_id: string
          run_at: string
          status: string
          token_in: number
          token_out: number
        }
        Insert: {
          brands?: Json | null
          citations?: Json | null
          competitors?: Json | null
          cost_est?: number
          id?: string
          prompt_id: string
          provider_id: string
          run_at?: string
          status: string
          token_in?: number
          token_out?: number
        }
        Update: {
          brands?: Json | null
          citations?: Json | null
          competitors?: Json | null
          cost_est?: number
          id?: string
          prompt_id?: string
          provider_id?: string
          run_at?: string
          status?: string
          token_in?: number
          token_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "v_competitor_share_7d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "prompt_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "v_prompt_visibility_7d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "prompt_runs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "llm_providers"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "recommendations_prompt_ref_fkey"
            columns: ["prompt_ref"]
            isOneToOne: false
            referencedRelation: "v_competitor_share_7d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "recommendations_prompt_ref_fkey"
            columns: ["prompt_ref"]
            isOneToOne: false
            referencedRelation: "v_prompt_visibility_7d"
            referencedColumns: ["prompt_id"]
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
      visibility_results: {
        Row: {
          brands_json: Json
          competitors_count: number
          id: string
          org_brand_present: boolean
          org_brand_prominence: number | null
          prompt_run_id: string
          raw_ai_response: string | null
          raw_evidence: string | null
          score: number
        }
        Insert: {
          brands_json: Json
          competitors_count?: number
          id?: string
          org_brand_present: boolean
          org_brand_prominence?: number | null
          prompt_run_id: string
          raw_ai_response?: string | null
          raw_evidence?: string | null
          score: number
        }
        Update: {
          brands_json?: Json
          competitors_count?: number
          id?: string
          org_brand_present?: boolean
          org_brand_prominence?: number | null
          prompt_run_id?: string
          raw_ai_response?: string | null
          raw_evidence?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "visibility_results_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_competitor_share_7d: {
        Row: {
          brand_norm: string | null
          mean_score: number | null
          n: number | null
          org_id: string | null
          prompt_id: string | null
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
      v_prompt_visibility_7d: {
        Row: {
          avg_score_7d: number | null
          org_id: string | null
          prompt_id: string | null
          runs_7d: number | null
          text: string | null
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
    }
    Functions: {
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
      test_reco_insert: {
        Args: { p_org_id: string; p_test_title?: string }
        Returns: string
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
