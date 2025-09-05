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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Admin batch trigger started');

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
    const results: any[] = [];

    // Process each organization
    for (const org of orgs) {
      try {
        console.log(`🏢 Processing org: ${org.name} (${org.id})`);
        
        // Call robust-batch-processor with cron secret
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { 
            action: 'create',
            orgId: org.id, 
            source: 'admin-batch-trigger',
            adminEmail: user.email,
            replace: false
          },
          headers: { 'x-cron-secret': cronSecret }
        });

        if (error) {
          console.error(`❌ Failed to trigger batch for org ${org.name}:`, error);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Batch triggered for org ${org.name}, result: ${data?.action}`);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            action: data?.action,
            batchJobId: data?.batchJobId
          });
          successfulJobs++;
        }

        processedOrgs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (orgError) {
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

    const result = {
      success: true,
      message: `Admin batch processing initiated for ${successfulJobs}/${processedOrgs} organizations`,
      adminUser: user.email,
      totalOrgs: orgs.length,
      processedOrgs,
      successfulJobs,
      results,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Admin batch trigger completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
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