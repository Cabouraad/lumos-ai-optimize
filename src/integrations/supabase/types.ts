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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_sources: {
        Row: {
          created_at: string
          date_tracked: string
          domain: string
          frequency: number
          id: string
          model: string
          org_id: string
          timestamp: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_tracked?: string
          domain: string
          frequency?: number
          id?: string
          model: string
          org_id: string
          timestamp?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_tracked?: string
          domain?: string
          frequency?: number
          id?: string
          model?: string
          org_id?: string
          timestamp?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          event_properties: Json | null
          id: string
          ip_address: string | null
          page_url: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          event_properties?: Json | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          event_properties?: Json | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      audit_events: {
        Row: {
          data: Json | null
          id: number
          level: string | null
          name: string | null
          phase: string | null
          run_id: string
          ts: string
        }
        Insert: {
          data?: Json | null
          id?: number
          level?: string | null
          name?: string | null
          phase?: string | null
          run_id: string
          ts?: string
        }
        Update: {
          data?: Json | null
          id?: number
          level?: string | null
          name?: string | null
          phase?: string | null
          run_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          artifact_url: string | null
          corr_id: string
          created_by: string
          details: Json | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          summary: Json | null
        }
        Insert: {
          artifact_url?: string | null
          corr_id: string
          created_by?: string
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status: string
          summary?: Json | null
        }
        Update: {
          artifact_url?: string | null
          corr_id?: string
          created_by?: string
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      batch_jobs: {
        Row: {
          completed_at: string | null
          completed_tasks: number
          created_at: string
          error_message: string | null
          failed_tasks: number
          id: string
          metadata: Json
          org_id: string
          providers: string[]
          started_at: string | null
          status: string
          total_tasks: number
          trigger_source: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          error_message?: string | null
          failed_tasks?: number
          id?: string
          metadata?: Json
          org_id: string
          providers?: string[]
          started_at?: string | null
          status?: string
          total_tasks?: number
          trigger_source?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          error_message?: string | null
          failed_tasks?: number
          id?: string
          metadata?: Json
          org_id?: string
          providers?: string[]
          started_at?: string | null
          status?: string
          total_tasks?: number
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "batch_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
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
      domain_authority_reference: {
        Row: {
          authority_score: number
          category: string | null
          created_at: string | null
          domain: string
          id: string
          last_updated: string | null
          notes: string | null
          tier: string
        }
        Insert: {
          authority_score: number
          category?: string | null
          created_at?: string | null
          domain: string
          id?: string
          last_updated?: string | null
          notes?: string | null
          tier: string
        }
        Update: {
          authority_score?: number
          category?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          last_updated?: string | null
          notes?: string | null
          tier?: string
        }
        Relationships: []
      }
      domain_invitations: {
        Row: {
          created_at: string | null
          domain_verified_at_invite: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          metadata: Json | null
          org_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain_verified_at_invite?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          org_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain_verified_at_invite?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          org_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "domain_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      free_checker_leads: {
        Row: {
          company_name: string | null
          created_at: string
          domain: string
          email: string
          id: string
          metadata: Json | null
          processed: boolean
          results_sent: boolean
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          domain: string
          email: string
          id?: string
          metadata?: Json | null
          processed?: boolean
          results_sent?: boolean
        }
        Update: {
          company_name?: string | null
          created_at?: string
          domain?: string
          email?: string
          id?: string
          metadata?: Json | null
          processed?: boolean
          results_sent?: boolean
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          processed: boolean
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          processed?: boolean
          source: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          processed?: boolean
          source?: string
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
      llumos_scores: {
        Row: {
          composite: number
          created_at: string
          id: string
          llumos_score: number
          org_id: string
          prompt_id: string | null
          reason: string | null
          scope: string
          submetrics: Json
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          composite: number
          created_at?: string
          id?: string
          llumos_score: number
          org_id: string
          prompt_id?: string | null
          reason?: string | null
          scope: string
          submetrics?: Json
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          composite?: number
          created_at?: string
          id?: string
          llumos_score?: number
          org_id?: string
          prompt_id?: string | null
          reason?: string | null
          scope?: string
          submetrics?: Json
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "llumos_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "llumos_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llumos_scores_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "low_visibility_prompts"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "llumos_scores_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_visibility_14d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "llumos_scores_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      optimizations_v2: {
        Row: {
          citations_used: Json | null
          completed_at: string | null
          content_hash: string
          content_specs: Json
          content_type: string
          created_at: string
          deleted_at: string | null
          description: string
          difficulty_level: string
          dismissed_at: string | null
          distribution_channels: Json
          estimated_hours: number | null
          generation_confidence: number | null
          id: string
          implementation_steps: Json
          llm_model: string | null
          llm_tokens_used: number | null
          optimization_category: string
          org_id: string
          priority_score: number
          prompt_context: Json | null
          prompt_id: string | null
          status: string
          success_metrics: Json
          title: string
          updated_at: string
        }
        Insert: {
          citations_used?: Json | null
          completed_at?: string | null
          content_hash: string
          content_specs?: Json
          content_type: string
          created_at?: string
          deleted_at?: string | null
          description: string
          difficulty_level?: string
          dismissed_at?: string | null
          distribution_channels?: Json
          estimated_hours?: number | null
          generation_confidence?: number | null
          id?: string
          implementation_steps?: Json
          llm_model?: string | null
          llm_tokens_used?: number | null
          optimization_category?: string
          org_id: string
          priority_score?: number
          prompt_context?: Json | null
          prompt_id?: string | null
          status?: string
          success_metrics?: Json
          title: string
          updated_at?: string
        }
        Update: {
          citations_used?: Json | null
          completed_at?: string | null
          content_hash?: string
          content_specs?: Json
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          difficulty_level?: string
          dismissed_at?: string | null
          distribution_channels?: Json
          estimated_hours?: number | null
          generation_confidence?: number | null
          id?: string
          implementation_steps?: Json
          llm_model?: string | null
          llm_tokens_used?: number | null
          optimization_category?: string
          org_id?: string
          priority_score?: number
          prompt_context?: Json | null
          prompt_id?: string | null
          status?: string
          success_metrics?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "optimizations_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_v2_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "low_visibility_prompts"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "optimizations_v2_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_visibility_14d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "optimizations_v2_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
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
          enable_ca_scoring: boolean | null
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
          updated_at: string | null
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
          enable_ca_scoring?: boolean | null
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
          updated_at?: string | null
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
          enable_ca_scoring?: boolean | null
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
          updated_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      prompt_provider_responses: {
        Row: {
          brands_json: Json
          citations_json: Json | null
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
          citations_json?: Json | null
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
          citations_json?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "prompt_provider_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "low_visibility_prompts"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "prompt_provider_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_visibility_14d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "prompt_provider_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          active: boolean
          cluster_tag: string | null
          created_at: string
          id: string
          org_id: string
          text: string
        }
        Insert: {
          active?: boolean
          cluster_tag?: string | null
          created_at?: string
          id?: string
          org_id: string
          text: string
        }
        Update: {
          active?: boolean
          cluster_tag?: string | null
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
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
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
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          byte_size: number | null
          created_at: string | null
          id: string
          org_id: string
          period_end: string
          period_start: string
          sha256: string | null
          storage_path: string
          updated_at: string | null
          week_key: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string | null
          id?: string
          org_id: string
          period_end: string
          period_start: string
          sha256?: string | null
          storage_path: string
          updated_at?: string | null
          week_key: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string | null
          id?: string
          org_id?: string
          period_end?: string
          period_start?: string
          sha256?: string | null
          storage_path?: string
          updated_at?: string | null
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
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
          trigger_source: string | null
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
          trigger_source?: string | null
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
          trigger_source?: string | null
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "suggested_prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_roles_org_id_fkey"
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
          org_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          org_id?: string | null
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          org_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_optimizations: {
        Row: {
          completed_at: string | null
          content_specifications: Json
          content_strategy: Json
          created_at: string
          description: string
          difficulty_level: string
          distribution_strategy: Json
          id: string
          impact_assessment: Json
          implementation_plan: Json
          optimization_type: string
          priority_score: number
          prompt_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          content_specifications?: Json
          content_strategy?: Json
          created_at?: string
          description: string
          difficulty_level?: string
          distribution_strategy?: Json
          id?: string
          impact_assessment?: Json
          implementation_plan?: Json
          optimization_type: string
          priority_score?: number
          prompt_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          content_specifications?: Json
          content_strategy?: Json
          created_at?: string
          description?: string
          difficulty_level?: string
          distribution_strategy?: Json
          id?: string
          impact_assessment?: Json
          implementation_plan?: Json
          optimization_type?: string
          priority_score?: number
          prompt_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_optimizations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "low_visibility_prompts"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "visibility_optimizations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_visibility_14d"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "visibility_optimizations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_report_requests: {
        Row: {
          created_at: string
          domain: string
          email: string
          id: string
          metadata: Json | null
          processed_at: string | null
          report_sent_at: string | null
          score: number | null
          status: string
        }
        Insert: {
          created_at?: string
          domain: string
          email: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          report_sent_at?: string | null
          score?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          domain?: string
          email?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          report_sent_at?: string | null
          score?: number | null
          status?: string
        }
        Relationships: []
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
      weekly_reports: {
        Row: {
          created_at: string
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          generated_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          status: string
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          status?: string
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          status?: string
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_sources_top_domains: {
        Row: {
          domain: string | null
          last_cited: string | null
          model_count: number | null
          models: string[] | null
          org_id: string | null
          total_citations: number | null
        }
        Relationships: []
      }
      low_visibility_prompts: {
        Row: {
          org_id: string | null
          presence_rate: number | null
          prompt_id: string | null
          prompt_text: string | null
          runs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_brand_detection_health: {
        Row: {
          avg_score_7d: number | null
          brand_detection_rate_pct: number | null
          brand_found_last_7d: number | null
          domain: string | null
          org_brands_in_catalog: number | null
          org_id: string | null
          org_name: string | null
          responses_last_7d: number | null
        }
        Relationships: []
      }
      org_competitor_analytics: {
        Row: {
          average_score: number | null
          competitor_name: string | null
          competitor_strength: string | null
          days_since_last_seen: number | null
          first_detected_at: string | null
          last_seen_at: string | null
          org_id: string | null
          recently_active: boolean | null
          total_appearances: number | null
        }
        Insert: {
          average_score?: number | null
          competitor_name?: string | null
          competitor_strength?: never
          days_since_last_seen?: never
          first_detected_at?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          recently_active?: never
          total_appearances?: number | null
        }
        Update: {
          average_score?: number | null
          competitor_name?: string | null
          competitor_strength?: never
          days_since_last_seen?: never
          first_detected_at?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          recently_active?: never
          total_appearances?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "brand_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_visibility_14d: {
        Row: {
          org_id: string | null
          presence_rate: number | null
          prompt_id: string | null
          prompt_text: string | null
          runs_14d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_public: {
        Row: {
          created_at: string | null
          id: string | null
          org_id: string | null
          period_ends_at: string | null
          plan_code: string | null
          status: string | null
          tier: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_brand_detection_health"
            referencedColumns: ["org_id"]
          },
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
    Functions: {
      admin_toggle_ca_scoring: {
        Args: { p_enable: boolean; p_org_id: string }
        Returns: undefined
      }
      approve_brand_candidate: {
        Args: { p_candidate_id: string; p_candidate_name: string }
        Returns: undefined
      }
      calculate_brand_prominence_from_response: {
        Args: { p_org_brands: string[]; p_raw_response: string }
        Returns: number
      }
      calculate_ca_submetric: {
        Args: {
          p_org_id: string
          p_prompt_id: string
          p_window_end: string
          p_window_start: string
        }
        Returns: number
      }
      calculate_citation_authority_score: {
        Args: { p_citations_json: Json; p_org_domains: string[] }
        Returns: number
      }
      clean_competitor_catalog: { Args: { p_dry_run?: boolean }; Returns: Json }
      compute_daily_llumos_scores: { Args: never; Returns: undefined }
      compute_llumos_score: {
        Args: { p_org_id: string; p_prompt_id?: string }
        Returns: Json
      }
      cron_schedule: {
        Args: { cron_schedule: string; job_name: string; sql_command: string }
        Returns: number
      }
      cron_unschedule: { Args: { job_name: string }; Returns: boolean }
      domain_root: { Args: { p_domain: string }; Returns: string }
      email_matches_org_domain: {
        Args: { email_address: string }
        Returns: boolean
      }
      extract_domain: { Args: { url: string }; Returns: string }
      fix_all_org_brand_classifications: {
        Args: never
        Returns: {
          result_avg_score_improvement: number
          result_brands_added: number
          result_org_id: string
          result_org_name: string
          result_responses_fixed: number
        }[]
      }
      fix_brand_classification_all_providers: { Args: never; Returns: string }
      fix_hubspot_brand_classification: { Args: never; Returns: string }
      fix_recent_brand_misclassifications: { Args: never; Returns: string }
      generate_verification_token: { Args: { org_id: string }; Returns: string }
      generate_week_key: { Args: { input_date: string }; Returns: string }
      get_brand_candidates_for_org: {
        Args: never
        Returns: {
          candidate_name: string
          detection_count: number
          first_detected_at: string
          id: string
          last_detected_at: string
          status: string
        }[]
      }
      get_cluster_tag_color: { Args: { tag: string }; Returns: string }
      get_competitor_share_7d: {
        Args: { p_org_id?: string }
        Returns: {
          competitor_name: string
          prompt_id: string
          share: number
          total_mentions: number
        }[]
      }
      get_cron_jobs_status: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      get_cron_secret: { Args: never; Returns: string }
      get_current_org_id: { Args: never; Returns: string }
      get_current_user_org_id: { Args: never; Returns: string }
      get_daily_usage: {
        Args: { p_date?: string; p_org_id: string }
        Returns: {
          prompts_used: number
          providers_used: number
        }[]
      }
      get_domain_authority_score: {
        Args: { p_domain: string }
        Returns: number
      }
      get_feature_flag: { Args: { flag_name: string }; Returns: boolean }
      get_latest_prompt_provider_responses: {
        Args: { p_org_id: string }
        Returns: {
          brands_json: Json
          citations_json: Json
          competitors_count: number
          competitors_json: Json
          error: string
          id: string
          metadata: Json
          model: string
          org_brand_present: boolean
          org_brand_prominence: number
          prompt_id: string
          provider: string
          raw_ai_response: string
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
      get_low_visibility_prompts: {
        Args: { p_limit?: number; p_org_id?: string }
        Returns: {
          avg_score_when_present: number
          last_checked_at: string
          presence_rate: number
          prompt_id: string
          prompt_text: string
          top_citations: Json
          total_runs: number
        }[]
      }
      get_optimization_recommendations: {
        Args: {
          p_category?: string
          p_limit?: number
          p_org_id: string
          p_status?: string
        }
        Returns: {
          content_type: string
          created_at: string
          description: string
          difficulty_level: string
          id: string
          priority_score: number
          prompt_text: string
          status: string
          title: string
        }[]
      }
      get_org_brand_aliases: { Args: { p_org_id: string }; Returns: string[] }
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
      get_org_competitor_summary_v2: {
        Args: {
          p_days?: number
          p_limit?: number
          p_offset?: number
          p_org_id?: string
          p_providers?: string[]
        }
        Returns: {
          avg_score: number
          competitor_name: string
          distinct_prompts: number
          first_seen: string
          last_seen: string
          share_pct: number
          total_mentions: number
          trend_score: number
        }[]
      }
      get_org_user_count: { Args: { org_id_param: string }; Returns: number }
      get_org_user_limit: { Args: { org_id_param: string }; Returns: number }
      get_prompt_competitors:
        | {
            Args: { p_days?: number; p_prompt_id: string }
            Returns: {
              competitor_name: string
              mentions: number
              share: number
            }[]
          }
        | {
            Args: { p_prompt_id: string }
            Returns: {
              competitor_name: string
              share: number
              total_mentions: number
            }[]
          }
      get_prompt_visibility_7d: {
        Args: { requesting_org_id?: string }
        Returns: {
          avg_score_7d: number
          prompt_id: string
          runs_7d: number
          text: string
        }[]
      }
      get_prompt_visibility_realtime: {
        Args: { p_days?: number; p_org_id: string }
        Returns: {
          last_run_at: string
          org_id: string
          presence_rate: number
          prompt_id: string
          prompt_text: string
          provider_breakdown: Json
          runs_total: number
        }[]
      }
      get_today_key_ny: { Args: { d?: string }; Returns: string }
      get_unified_dashboard_data: { Args: { p_org_id: string }; Returns: Json }
      get_user_org_and_role: {
        Args: { _user_id: string }
        Returns: {
          org_id: string
          role: string
        }[]
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_user_subscription_status: { Args: never; Returns: Json }
      get_week_boundaries: {
        Args: { input_date: string }
        Returns: {
          week_end: string
          week_start: string
        }[]
      }
      get_weekly_report_cron_status: {
        Args: never
        Returns: {
          active: boolean
          job_name: string
          last_run: string
          schedule: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      increment_failed_tasks: { Args: { job_id: string }; Returns: undefined }
      is_competitor_domain: {
        Args: { p_domain: string; p_org_id: string }
        Returns: boolean
      }
      mark_domain_verified: { Args: { org_id: string }; Returns: boolean }
      org_domain_set: { Args: { p_org_id: string }; Returns: string[] }
      rebuild_competitors_catalog_only: { Args: never; Returns: string }
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
      refresh_dashboard_metrics: { Args: never; Returns: undefined }
      reject_brand_candidate: {
        Args: { p_candidate_id: string }
        Returns: undefined
      }
      run_security_audit: {
        Args: never
        Returns: {
          details: string
          fix_hint: string
          issue: string
          item_kind: string
          object_name: string
          schema_name: string
          severity: string
        }[]
      }
      sync_competitor_detection_automated: { Args: never; Returns: undefined }
      test_reco_insert: {
        Args: { p_org_id: string; p_test_title?: string }
        Returns: string
      }
      test_rls_isolation: { Args: never; Returns: string }
      try_mark_daily_run: { Args: { p_today_key: string }; Returns: Json }
      update_org_business_context: {
        Args: {
          p_business_city?: string
          p_business_country?: string
          p_business_description?: string
          p_business_state?: string
          p_competitors?: string[]
          p_enable_localized_prompts?: boolean
          p_keywords?: string[]
          p_products_services?: string
          p_target_audience?: string
        }
        Returns: undefined
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
      user_can_access_org: { Args: { target_org_id: string }; Returns: boolean }
      user_org_domain_verified: { Args: never; Returns: boolean }
      validate_domain_invitation: {
        Args: { p_email: string; p_org_id: string }
        Returns: Json
      }
      validate_org_membership: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      validate_role_consistency: {
        Args: never
        Returns: {
          status: string
          user_id: string
          user_roles_role: string
          users_role: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "member" | "admin"
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
      app_role: ["owner", "member", "admin"],
    },
  },
} as const
