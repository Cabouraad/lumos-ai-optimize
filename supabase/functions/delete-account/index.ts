import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting account deletion process');

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey
      });
      throw new Error('Missing required environment variables');
    }

    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Create regular client to verify user authentication
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No authorization header' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Set the auth token for regular client
    const token = authHeader.replace('Bearer ', '');
    console.log('Setting auth token, length:', token.length);

    // Get current user to verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication failed: ' + (userError?.message || 'No user found')
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Deleting account for user: ${user.email} (${user.id})`);

    // Get user's org to clean up org-related data
    const { data: userData, error: orgError } = await supabaseAdmin
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (orgError) {
      console.error('Error getting user data:', orgError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to get user data: ' + orgError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = userData?.org_id;
    const userRole = userData?.role;
    console.log('User data:', { orgId, userRole });

    // If user is org owner and there are other users in the org, prevent deletion
    if (userRole === 'owner' && orgId) {
      console.log('Checking for other users in organization...');
      const { data: otherUsers, error: otherUsersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .neq('id', user.id);

      if (otherUsersError) {
        console.error('Error checking other users:', otherUsersError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to check organization users: ' + otherUsersError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (otherUsers && otherUsers.length > 0) {
        console.log('Found other users, preventing deletion');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Cannot delete account: You are the organization owner and there are other users. Please transfer ownership first.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Start data cleanup
    console.log('Starting data cleanup...');

    try {
      if (orgId) {
        // Get all prompts for this org to clean up runs
        console.log('Getting prompts for org:', orgId);
        const { data: prompts, error: promptsError } = await supabaseAdmin
          .from('prompts')
          .select('id')
          .eq('org_id', orgId);

        if (promptsError) {
          console.error('Error getting prompts:', promptsError);
        } else if (prompts && prompts.length > 0) {
          const promptIds = prompts.map(p => p.id);
          console.log('Found prompts:', promptIds.length);
          
          // Get prompt runs to find visibility results
          const { data: promptRuns, error: runsError } = await supabaseAdmin
            .from('prompt_runs')
            .select('id')
            .in('prompt_id', promptIds);

          if (!runsError && promptRuns && promptRuns.length > 0) {
            const runIds = promptRuns.map(r => r.id);
            console.log('Deleting visibility results for runs:', runIds.length);
            
            // Delete visibility results first (foreign key dependency)
            const { error: visibilityError } = await supabaseAdmin
              .from('visibility_results')
              .delete()
              .in('prompt_run_id', runIds);

            if (visibilityError) {
              console.error('Error deleting visibility results:', visibilityError);
            }
          }

          // Delete prompt runs
          console.log('Deleting prompt runs...');
          const { error: runsDeleteError } = await supabaseAdmin
            .from('prompt_runs')
            .delete()
            .in('prompt_id', promptIds);

          if (runsDeleteError) {
            console.error('Error deleting prompt runs:', runsDeleteError);
          }
        }

        // Clean up org-related data
        console.log('Cleaning up organization data...');
        const cleanupTables = [
          'prompts',
          'suggested_prompts', 
          'recommendations',
          'brand_catalog',
          'competitor_mentions',
          'llms_generations'
        ];

        for (const table of cleanupTables) {
          console.log(`Cleaning up ${table}...`);
          const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('org_id', orgId);
          
          if (error) {
            console.error(`Error cleaning up ${table}:`, error);
          }
        }
        
        // If user is the only one in org, delete the org
        if (userRole === 'owner') {
          console.log('Deleting organization...');
          const { error: orgDeleteError } = await supabaseAdmin
            .from('organizations')
            .delete()
            .eq('id', orgId);
          
          if (orgDeleteError) {
            console.error('Error deleting organization:', orgDeleteError);
          }
        }
      }

      // Clean up subscription data
      console.log('Cleaning up subscription data...');
      const { error: subError } = await supabaseAdmin
        .from('subscribers')
        .delete()
        .eq('user_id', user.id);

      if (subError) {
        console.error('Error cleaning up subscribers:', subError);
      }

      // Remove user from users table
      console.log('Removing user record...');
      const { error: userDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user.id);

      if (userDeleteError) {
        console.error('Error deleting user record:', userDeleteError);
      }

      // Finally, delete the auth user
      console.log('Deleting auth user...');
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      if (deleteError) {
        console.error('Error deleting auth user:', deleteError);
        throw new Error(`Failed to delete user: ${deleteError.message}`);
      }

      console.log('Account deletion completed successfully');

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Account deleted successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      throw cleanupError;
    }

  } catch (error) {
    console.error('Error in delete-account function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});