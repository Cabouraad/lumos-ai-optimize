export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      brand_catalog: {
        Row: {
          id: string
          is_org_brand: boolean
          name: string
          org_id: string
          variants_json: Json
        }
        Insert: {
          id?: string
          is_org_brand?: boolean
          name: string
          org_id: string
          variants_json?: Json
        }
        Update: {
          id?: string
          is_org_brand?: boolean
          name?: string
          org_id?: string
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
          created_at: string
          domain: string
          domain_locked_at: string | null
          domain_verification_method: string | null
          id: string
          name: string
          plan_tier: string
        }
        Insert: {
          created_at?: string
          domain: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          id?: string
          name: string
          plan_tier: string
        }
        Update: {
          created_at?: string
          domain?: string
          domain_locked_at?: string | null
          domain_verification_method?: string | null
          id?: string
          name?: string
          plan_tier?: string
        }
        Relationships: []
      }
      prompt_runs: {
        Row: {
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
          org_brand_prominence: number
          prompt_run_id: string
          raw_evidence: string | null
          score: number
        }
        Insert: {
          brands_json: Json
          competitors_count?: number
          id?: string
          org_brand_present: boolean
          org_brand_prominence: number
          prompt_run_id: string
          raw_evidence?: string | null
          score: number
        }
        Update: {
          brands_json?: Json
          competitors_count?: number
          id?: string
          org_brand_present?: boolean
          org_brand_prominence?: number
          prompt_run_id?: string
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
