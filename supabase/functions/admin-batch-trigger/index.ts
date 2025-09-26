import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getStrictCorsHeaders } from "../_shared/cors.ts";

// Allowed admin emails
const ADMIN_EMAILS = ['abouraa.chri@gmail.com', 'amirdt22@gmail.com'];

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('📝 Handling OPTIONS preflight request from:', requestOrigin);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const runId = crypto.randomUUID();
    console.log('🔐 Admin batch trigger started', { runId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header and extract JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing bearer token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Validate JWT and get user info
    const jwt = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(jwt);
    if (authError || !user) {
      console.error('❌ Invalid JWT token:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user email is in admin list
    if (!ADMIN_EMAILS.includes(user.email || '')) {
      console.error('❌ User not authorized for admin functions:', user.email);
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('✅ Admin user authenticated:', user.email);

    // Parse request body to get options
    let requestBody: any = {};
    try {
      const body = await req.text();
      if (body) {
        requestBody = JSON.parse(body);
      }
    } catch (e: unknown) {
      // Not JSON or empty body, continue
    }

    const replaceJobs = requestBody.replace === true;
    const preflightOnly = requestBody.preflight === true;

    // Get cron secret for calling batch processor
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get all organizations with active prompts using service role
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (orgsError) {
      console.error('❌ Failed to fetch organizations:', orgsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organizations' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations with active prompts to process',
        totalOrgs: 0,
        processedOrgs: 0,
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${orgs.length} organizations with active prompts`);

    let processedOrgs = 0;
    let successfulJobs = 0;
    let skippedOrgs = 0;
    const results: any[] = [];

    // Process each organization
    for (const org of orgs) {
      try {
        console.log(`🏢 Processing org: ${org.name} (${org.id})`);
        
        // Run preflight check first
        console.log(`🔍 Running preflight for org ${org.id}...`);
        const { data: preflightData, error: preflightError } = await supabase.functions.invoke('robust-batch-processor', {
          body: { 
            action: 'preflight',
            orgId: org.id
          },
          headers: { 'x-cron-secret': cronSecret }
        });

        if (preflightError) {
          console.error(`❌ Preflight failed for org ${org.name}:`, preflightError);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            action: 'preflight_failed',
            error: preflightError.message,
            promptCount: 0,
            availableProviders: [],
            expectedTasks: 0,
            skipReason: 'Preflight check failed'
          });
          processedOrgs++;
          continue;
        }

        const promptCount = preflightData?.prompts?.count || 0;
        const availableProviders = preflightData?.providers?.available || [];
        const expectedTasks = preflightData?.expectedTasks || 0;
        const quotaAllowed = preflightData?.quota?.allowed || false;

        // Check if we should skip this org
        let skipReason = null;
        if (promptCount === 0) {
          skipReason = 'No active prompts found';
        } else if (availableProviders.length === 0) {
          skipReason = 'No API keys configured for any providers';
        } else if (!quotaAllowed) {
          skipReason = 'Daily quota exceeded';
        } else if (expectedTasks === 0) {
          skipReason = 'No tasks would be created';
        }

        if (skipReason) {
          console.log(`⏭️ Skipping org ${org.name}: ${skipReason}`);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            action: 'skipped',
            promptCount,
            availableProviders,
            expectedTasks,
            skipReason
          });
          skippedOrgs++;
          processedOrgs++;
          continue;
        }

        // If preflight only, don't actually run batch
        if (preflightOnly) {
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            action: 'preflight_only',
            promptCount,
            availableProviders,
            expectedTasks
          });
          processedOrgs++;
          continue;
        }
        
        // Call robust-batch-processor with cron secret
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { 
            action: 'create',
            orgId: org.id, 
            source: 'admin-batch-trigger',
            adminEmail: user.email,
            replace: replaceJobs,
            correlationId: runId
          },
          headers: { 'x-cron-secret': cronSecret }
        });

        if (error) {
          console.error(`❌ Failed to trigger batch for org ${org.name}:`, error);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            action: 'batch_failed',
            error: error.message,
            promptCount,
            availableProviders,
            expectedTasks
          });
        } else {
          console.log(`✅ Batch triggered for org ${org.name}, result: ${data?.action}`);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            action: data?.action,
            batchJobId: data?.batchJobId,
            promptCount,
            availableProviders,
            expectedTasks,
            processedTasks: data?.processedTasks || data?.totalTasks || 0
          });
          successfulJobs++;
        }

        processedOrgs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (orgError: unknown) {
        console.error(`❌ Error processing org ${org.name}:`, orgError);
        results.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: orgError instanceof Error ? orgError.message : String(orgError)
        });
        processedOrgs++;
      }
    }

    // Calculate summary statistics
    const totalPrompts = results.reduce((sum, r) => sum + (r.promptCount || 0), 0);
    const totalExpectedTasks = results.reduce((sum, r) => sum + (r.expectedTasks || 0), 0);
    const providersUsed = [...new Set(results.flatMap((r: any) => r.availableProviders || []))];

    const result = {
      success: true,
      runId,
      message: preflightOnly 
        ? `Preflight completed for ${processedOrgs} organizations`
        : replaceJobs
        ? `Admin batch processing initiated (with job replacement) for ${successfulJobs}/${processedOrgs} organizations`
        : `Admin batch processing initiated for ${successfulJobs}/${processedOrgs} organizations`,
      adminUser: user.email,
      options: {
        replace: replaceJobs,
        preflightOnly
      },
      summary: {
        totalOrgs: orgs.length,
        processedOrgs,
        successfulJobs,
        skippedOrgs,
        totalPrompts,
        totalExpectedTasks,
        providersUsed
      },
      results,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Admin batch trigger completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('❌ Admin batch trigger error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});