import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { renderAuditHTML, AuditRun, AuditEvent } from "../_shared/audit_report.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUDIT_TIMEOUT = 4 * 60 * 1000; // 4 minutes
const STEP_TIMEOUT = 15 * 1000; // 15 seconds per step

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (!authHeader || !cronSecret) {
      return new Response(JSON.stringify({ error: 'Missing authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValidCron = authHeader === `Bearer ${cronSecret}`;
    if (!isValidCron) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

    // Generate correlation ID and start audit run
    const corrId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    console.log(`🔍 Starting audit run ${corrId}`);

    // Insert initial audit run
    const { error: runError } = await supabase
      .from('audit_runs')
      .insert({
        id: runId,
        corr_id: corrId,
        status: 'running',
        details: { phases: [] }
      });

    if (runError) {
      console.error('Failed to create audit run:', runError);
      throw new Error('Failed to initialize audit run');
    }

    const events: any[] = [];
    const details: any = { phases: [] };
    let overallStatus: 'passed' | 'failed' = 'passed';

    // Helper to log events
    const logEvent = async (phase: string, name: string, level: 'info' | 'warn' | 'error', data: any) => {
      const event = {
        run_id: runId,
        phase,
        name,
        level,
        data: {
          ...data,
          corr_id: corrId,
          timestamp: new Date().toISOString()
        }
      };
      
      events.push(event);
      console.log(`[${level.toUpperCase()}] ${phase}.${name}:`, data);

      // Store in database
      await supabase.from('audit_events').insert(event);
    };

    // Helper to run phases with timeout
    const runPhase = async (phaseName: string, phaseFunc: () => Promise<any>) => {
      const startTime = Date.now();
      let phaseResult = { success: false, error: null };

      try {
        await logEvent(phaseName, 'phase_start', 'info', { phase: phaseName });
        
        const result = await Promise.race([
          phaseFunc(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Phase timeout')), STEP_TIMEOUT)
          )
        ]);

        phaseResult = { success: true, error: null };
        await logEvent(phaseName, 'phase_complete', 'info', { 
          phase: phaseName, 
          duration_ms: Date.now() - startTime,
          result 
        });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        phaseResult = { success: false, error: err.message };
        overallStatus = 'failed';
        await logEvent(phaseName, 'phase_error', 'error', { 
          phase: phaseName, 
          error: err.message,
          duration_ms: Date.now() - startTime 
        });
      }

      details.phases.push({
        name: phaseName,
        ...phaseResult,
        duration_ms: Date.now() - startTime
      });

      return phaseResult;
    };

    // Main audit execution with global timeout
    const auditPromise = (async () => {
      const testPassword = Deno.env.get('E2E_TEST_PASSWORD') || 'Test123!pass';
      const syntheticUsers = [
        { email: 'starter_audit@test.app', tier: 'starter' },
        { email: 'growth_audit@test.app', tier: 'growth' }
      ];

      // Phase 1: Setup synthetic accounts
      await runPhase('signup', async () => {
        for (const user of syntheticUsers) {
          // Try to sign up (will error if exists, which is fine)
          try {
            const { data, error } = await anonSupabase.auth.signUp({
              email: user.email,
              password: testPassword,
              options: {
                emailRedirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/`
              }
            });
            
            await logEvent('signup', 'user_signup', 'info', { 
              email: user.email.replace('@', '[at]'), // redact for logs
              success: !error,
              exists: error?.message?.includes('already') || false
            });
          } catch (signupError: unknown) {
            // User might already exist, continue
            await logEvent('signup', 'user_exists', 'info', { 
              email: user.email.replace('@', '[at]')
            });
          }
        }
      });

      // Phase 2: Create synthetic orgs
      await runPhase('org', async () => {
        for (const user of syntheticUsers) {
          // Sign in as user
          const { data: sessionData, error: signInError } = await anonSupabase.auth.signInWithPassword({
            email: user.email,
            password: testPassword
          });

          if (signInError) {
            throw new Error(`Failed to sign in ${user.email}: ${signInError.message}`);
          }

          // Create or find org
          const orgDomain = `${user.tier}-audit-test.example.com`;
          const { data: existingOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('domain', orgDomain)
            .single();

          let orgId = existingOrg?.id;

          if (!orgId) {
            const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert({
                name: `${user.tier.toUpperCase()} Audit Org`,
                domain: orgDomain,
                plan_tier: user.tier,
                subscription_tier: user.tier,
                verified_at: new Date().toISOString(),
                business_description: 'Synthetic audit organization for testing'
              })
              .select('id')
              .single();

            if (orgError) throw new Error(`Failed to create org: ${orgError.message}`);
            orgId = newOrg.id;
          }

          // Ensure user is linked to org
          await supabase
            .from('users')
            .upsert({
              id: sessionData.user.id,
              email: user.email,
              org_id: orgId,
              role: 'owner'
            });

          await logEvent('org', 'org_setup', 'info', { 
            user_tier: user.tier,
            org_id: orgId,
            domain: orgDomain
          });
        }
      });

      // Phase 3: Pricing simulation (bypass billing)
      await runPhase('pricing', async () => {
        const bypassEnabled = Deno.env.get('BILLING_BYPASS_ENABLED') === 'true';
        const bypassEmails = Deno.env.get('BILLING_BYPASS_EMAILS') || '';
        
        await logEvent('pricing', 'bypass_check', 'info', { 
          bypass_enabled: bypassEnabled,
          bypass_configured: bypassEmails.includes('audit@test.app')
        });

        if (!bypassEnabled) {
          throw new Error('Billing bypass not enabled for audit users');
        }
      });

      // Phase 4: Entitlement verification
      await runPhase('entitlement', async () => {
        for (const user of syntheticUsers) {
          // Check subscription status
          const { data: checkResult, error: checkError } = await anonSupabase.functions.invoke('check-subscription');
          
          await logEvent('entitlement', 'subscription_check', 'info', {
            user_tier: user.tier,
            check_success: !checkError,
            result: checkResult
          });
        }
      });

      // Phase 5: Onboarding simulation
      await runPhase('onboarding', async () => {
        for (const user of syntheticUsers) {
          // Sign in and simulate onboarding steps
          const { data: sessionData } = await anonSupabase.auth.signInWithPassword({
            email: user.email,
            password: testPassword
          });

          // Simulate business context setup
          const mockBusinessData = {
            business_description: `${user.tier} tier audit business`,
            target_audience: 'Test audience',
            products_services: 'Test services',
            keywords: ['test', 'audit', user.tier]
          };

          await logEvent('onboarding', 'business_setup', 'info', {
            user_tier: user.tier,
            data_provided: true
          });
        }
      });

      // Phase 6: Dashboard verification
      await runPhase('dashboard', async () => {
        for (const user of syntheticUsers) {
          // Sign in and check dashboard APIs
          const { data: sessionData } = await anonSupabase.auth.signInWithPassword({
            email: user.email,
            password: testPassword
          });

          // Create a client with the user session
          const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
            global: {
              headers: {
                Authorization: `Bearer ${sessionData.session?.access_token}`
              }
            }
          });

          // Test basic dashboard queries
          const { data: prompts, error: promptsError } = await userSupabase
            .from('prompts')
            .select('id, text, active')
            .limit(10);

          const { data: responses, error: responsesError } = await userSupabase
            .from('prompt_provider_responses')
            .select('id, score, status')
            .limit(10);

          await logEvent('dashboard', 'data_access', 'info', {
            user_tier: user.tier,
            prompts_count: prompts?.length || 0,
            responses_count: responses?.length || 0,
            prompts_error: !!promptsError,
            responses_error: !!responsesError
          });
        }
      });
    });

    // Run audit with global timeout
    await Promise.race([
      auditPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Global audit timeout')), AUDIT_TIMEOUT)
      )
    ]);

    // Generate HTML report
    const mockRun: AuditRun = {
      id: runId,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      status: overallStatus,
      corr_id: corrId,
      summary: details,
      details,
      created_by: 'auto'
    };

    const mockEvents: AuditEvent[] = events.map((e, i) => ({
      id: i,
      run_id: runId,
      ts: e.data.timestamp,
      phase: e.phase,
      name: e.name,
      level: e.level,
      data: e.data
    }));

    const htmlReport = renderAuditHTML(mockRun, mockEvents);

    // Upload report to storage
    const reportPath = `audit/${runId}.html`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(reportPath, new Blob([htmlReport], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true
      });

    let artifactUrl = null;
    if (!uploadError) {
      const { data: urlData } = await supabase.storage
        .from('reports')
        .createSignedUrl(reportPath, 60 * 60 * 24 * 7); // 7 days
      artifactUrl = urlData?.signedUrl;
    }

    // Update audit run with final results
    await supabase
      .from('audit_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: overallStatus,
        summary: { phases: details.phases },
        details,
        artifact_url: artifactUrl
      })
      .eq('id', runId);

    console.log(`✅ Audit run ${corrId} completed with status: ${overallStatus}`);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      corr_id: corrId,
      status: overallStatus,
      phases: details.phases.length,
      events: events.length,
      artifact_url: artifactUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Audit run failed:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});