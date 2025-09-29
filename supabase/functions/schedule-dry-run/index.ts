import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getStrictCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON_SECRET
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid CRON_SECRET' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const correlationId = crypto.randomUUID();
    console.log(`🧪 [E2E DRY RUN] Starting with correlation ID: ${correlationId}`);

    // Set environment flag for dry run
    const isDryRun = Deno.env.get('E2E_DRY_RUN_SCHEDULER') === 'true';
    
    if (!isDryRun) {
      console.log('⚠️ E2E_DRY_RUN_SCHEDULER not enabled, performing actual operations');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      correlationId,
      dryRun: isDryRun,
      timestamp: new Date().toISOString(),
      operations: [] as any[]
    };

    // Simulate daily scan
    console.log('🔄 Simulating daily scan...');
    if (isDryRun) {
      results.operations.push({
        type: 'daily-scan',
        status: 'dry-run-simulated',
        message: 'Would scan all active prompts for all organizations',
        timestamp: new Date().toISOString()
      });
    } else {
      // Call actual daily scan (but mark it as test)
      try {
        const scanResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/robust-batch-processor`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
            'x-cron-secret': expectedSecret
          },
          body: JSON.stringify({ testRun: true, correlationId })
        });
        
        const scanResult = await scanResponse.json();
        results.operations.push({
          type: 'daily-scan',
          status: scanResponse.ok ? 'success' : 'error',
          result: scanResult,
          timestamp: new Date().toISOString()
        });
  } catch (error: unknown) {
        results.operations.push({
          type: 'daily-scan',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Simulate weekly report generation
    console.log('📊 Simulating weekly report generation...');
    if (isDryRun) {
      results.operations.push({
        type: 'weekly-report',
        status: 'dry-run-simulated',
        message: 'Would generate weekly reports for all eligible organizations',
        timestamp: new Date().toISOString()
      });
    } else {
      // Call actual weekly report generation for test orgs only
      const { data: testOrgs } = await supabase
        .from('organizations')
        .select('id')
        .in('domain', ['starter-e2e.test', 'growth-e2e.test']);

      for (const org of testOrgs || []) {
        try {
          const reportResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/weekly-report`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
              'x-cron-secret': expectedSecret
            },
            body: JSON.stringify({ orgId: org.id, testRun: true, correlationId })
          });
          
          const reportResult = await reportResponse.json();
          results.operations.push({
            type: 'weekly-report',
            orgId: org.id,
            status: reportResponse.ok ? 'success' : 'error',
            result: reportResult,
            timestamp: new Date().toISOString()
          });
        } catch (error: unknown) {
          results.operations.push({
            type: 'weekly-report',
            orgId: org.id,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Log summary
    console.log(`✅ [E2E DRY RUN] Completed ${results.operations.length} operations`);
    
    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ [E2E DRY RUN] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});