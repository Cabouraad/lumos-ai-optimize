import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getUserOrgAndRole } from '../_shared/auth-v2.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemoveUserRequest {
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create client with user's token for auth
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user's org and role
    const { orgId, role } = await getUserOrgAndRole(userSupabase);
    
    if (role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only organization owners can remove users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId }: RemoveUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user ID
    const { data: { user: currentUser } } = await userSupabase.auth.getUser();

    // Prevent removing yourself
    if (userId === currentUser?.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot remove yourself from the organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists and belongs to this org
    const { data: userToRemove, error: userError } = await supabase
      .from('users')
      .select('id, email, role, org_id')
      .eq('id', userId)
      .eq('org_id', orgId)
      .single();

    if (userError || !userToRemove) {
      return new Response(
        JSON.stringify({ error: 'User not found in this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is the last owner
    if (userToRemove.role === 'owner') {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner');

      if (count && count <= 1) {
        return new Response(
          JSON.stringify({ error: 'Cannot remove the last owner. Transfer ownership first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Remove user role entries
    const { error: roleDeleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (roleDeleteError) {
      console.error('Error deleting user roles:', roleDeleteError);
    }

    // Remove user from organization (set org_id to null)
    const { error: updateError } = await supabase
      .from('users')
      .update({ org_id: null, role: 'member' })
      .eq('id', userId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('Error removing user from organization:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to remove user from organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} removed from organization ${orgId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User removed from organization successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in remove-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
