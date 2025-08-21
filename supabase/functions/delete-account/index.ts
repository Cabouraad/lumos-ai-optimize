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

    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Create regular client to verify user authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Set the auth token for regular client
    supabaseClient.auth.setSession({
      access_token: authHeader.replace('Bearer ', ''),
      refresh_token: '',
    } as any);

    // Get current user to verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`Deleting account for user: ${user.email}`);

    // Get user's org to clean up org-related data
    const { data: userData, error: orgError } = await supabaseAdmin
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (orgError) {
      console.error('Error getting user data:', orgError);
    }

    const orgId = userData?.org_id;
    const userRole = userData?.role;

    // Start transaction-like cleanup
    console.log('Starting data cleanup...');

    // If user is org owner and there are other users in the org, prevent deletion
    if (userRole === 'owner' && orgId) {
      const { data: otherUsers, error: otherUsersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .neq('id', user.id);

      if (!otherUsersError && otherUsers && otherUsers.length > 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Cannot delete account: You are the organization owner and there are other users. Please transfer ownership first.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Clean up user-specific data
    console.log('Cleaning up prompt runs...');
    if (orgId) {
      // Get all prompts for this org to clean up runs
      const { data: prompts } = await supabaseAdmin
        .from('prompts')
        .select('id')
        .eq('org_id', orgId);

      if (prompts && prompts.length > 0) {
        const promptIds = prompts.map(p => p.id);
        
        // Delete visibility results first (foreign key dependency)
        await supabaseAdmin
          .from('visibility_results')
          .delete()
          .in('prompt_run_id', 
            await supabaseAdmin
              .from('prompt_runs')
              .select('id')
              .in('prompt_id', promptIds)
              .then(res => res.data?.map(r => r.id) || [])
          );

        // Delete prompt runs
        await supabaseAdmin
          .from('prompt_runs')
          .delete()
          .in('prompt_id', promptIds);
      }

      console.log('Cleaning up organization data...');
      // Clean up org-related data
      await supabaseAdmin.from('prompts').delete().eq('org_id', orgId);
      await supabaseAdmin.from('suggested_prompts').delete().eq('org_id', orgId);
      await supabaseAdmin.from('recommendations').delete().eq('org_id', orgId);
      await supabaseAdmin.from('brand_catalog').delete().eq('org_id', orgId);
      await supabaseAdmin.from('competitor_mentions').delete().eq('org_id', orgId);
      await supabaseAdmin.from('llms_generations').delete().eq('org_id', orgId);
      
      // If user is the only one in org, delete the org
      if (userRole === 'owner') {
        await supabaseAdmin.from('organizations').delete().eq('id', orgId);
      }
    }

    // Clean up subscription data
    console.log('Cleaning up subscription data...');
    await supabaseAdmin.from('subscribers').delete().eq('user_id', user.id);

    // Remove user from users table
    console.log('Removing user record...');
    await supabaseAdmin.from('users').delete().eq('id', user.id);

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

  } catch (error) {
    console.error('Error in delete-account function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});