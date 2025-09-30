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
      batch_jobs_archive: {
        Row: {
          archived_at: string
          archived_reason: string
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
          archived_at?: string
          archived_reason?: string
          cancellation_requested?: boolean
          completed_at?: string | null
          completed_tasks?: number
          created_at: string
          failed_tasks?: number
          id: string
          last_heartbeat?: string | null
          metadata?: Json | null
          org_id: string
          runner_id?: string | null
          started_at?: string | null
          status: string
          total_tasks?: number
        }
        Update: {
          archived_at?: string
          archived_reason?: string
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
      batch_tasks_archive: {
        Row: {
          archived_at: string
          archived_reason: string
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
          archived_at?: string
          archived_reason?: string
          attempts?: number
          batch_job_id: string
          completed_at?: string | null
          created_at: string
          error_message?: string | null
          id: string
          prompt_id: string
          provider: string
          result?: Json | null
          started_at?: string | null
          status: string
        }
        Update: {
          archived_at?: string
          archived_reason?: string
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
        Relationships: []
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
      domain_invitations: {
        Row: {
          created_at: string | null
          domain_verified_at_invite: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
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
          org_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
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
      optimization_jobs: {
        Row: {
          created_at: string
          error_text: string | null
          finished_at: string | null
          id: string
          input_hash: string
          model_version: string | null
          org_id: string
          prompt_ids: string[] | null
          requested_by: string
          scope: string
          started_at: string | null
          status: string
          target_week: string | null
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          input_hash: string
          model_version?: string | null
          org_id: string
          prompt_ids?: string[] | null
          requested_by: string
          scope: string
          started_at?: string | null
          status?: string
          target_week?: string | null
        }
        Update: {
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          input_hash?: string
          model_version?: string | null
          org_id?: string
          prompt_ids?: string[] | null
          requested_by?: string
          scope?: string
          started_at?: string | null
          status?: string
          target_week?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      optimizations: {
        Row: {
          body: string | null
          content_type: string
          created_at: string
          difficulty_level: string | null
          id: string
          impact_score: number | null
          implementation_details: Json | null
          job_id: string | null
          optimization_category: string
          org_id: string
          projected_impact: string | null
          prompt_id: string
          provider: string
          reddit_strategy: Json | null
          resources: Json | null
          score_before: number | null
          sources: Json | null
          success_metrics: Json | null
          timeline_weeks: number | null
          title: string | null
        }
        Insert: {
          body?: string | null
          content_type: string
          created_at?: string
          difficulty_level?: string | null
          id?: string
          impact_score?: number | null
          implementation_details?: Json | null
          job_id?: string | null
          optimization_category?: string
          org_id: string
          projected_impact?: string | null
          prompt_id: string
          provider?: string
          reddit_strategy?: Json | null
          resources?: Json | null
          score_before?: number | null
          sources?: Json | null
          success_metrics?: Json | null
          timeline_weeks?: number | null
          title?: string | null
        }
        Update: {
          body?: string | null
          content_type?: string
          created_at?: string
          difficulty_level?: string | null
          id?: string
          impact_score?: number | null
          implementation_details?: Json | null
          job_id?: string | null
          optimization_category?: string
          org_id?: string
          projected_impact?: string | null
          prompt_id?: string
          provider?: string
          reddit_strategy?: Json | null
          resources?: Json | null
          score_before?: number | null
          sources?: Json | null
          success_metrics?: Json | null
          timeline_weeks?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "optimization_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_prompt_id_fkey"
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
            referencedRelation: "prompts"
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
      low_visibility_prompts: {
        Row: {
          org_id: string | null
          presence_rate: number | null
          prompt_id: string | null
          prompt_text: string | null
          runs: number | null
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      clean_old_batch_jobs: {
        Args: { days_old?: number; dry_run?: boolean }
        Returns: Json
      }
      cleanup_old_scheduler_runs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      email_matches_org_domain: {
        Args: { email_address: string }
        Returns: boolean
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
      generate_week_key: {
        Args: { input_date: string }
        Returns: string
      }
      get_batch_cleanup_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
        Args: Record<PropertyKey, never>
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
      get_cron_secret: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_org_id: {
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
        Args: { p_days?: number; p_prompt_id: string } | { p_prompt_id: string }
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
      get_today_key_ny: {
        Args: { d?: string }
        Returns: string
      }
      get_unified_dashboard_data: {
        Args: { p_org_id?: string }
        Returns: Json
      }
      get_user_subscription_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_week_boundaries: {
        Args: { input_date: string }
        Returns: {
          week_end: string
          week_start: string
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
      run_security_audit: {
        Args: Record<PropertyKey, never>
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
      sync_competitor_detection_automated: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      test_reco_insert: {
        Args: { p_org_id: string; p_test_title?: string }
        Returns: string
      }
      test_rls_isolation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      try_mark_daily_run: {
        Args: { p_today_key: string }
        Returns: Json
      }
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
      user_can_access_org: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      user_org_domain_verified: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_domain_invitation: {
        Args: { p_email: string; p_org_id: string }
        Returns: Json
      }
      validate_org_membership: {
        Args: { target_org_id: string }
        Returns: boolean
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
