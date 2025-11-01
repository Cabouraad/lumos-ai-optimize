import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getUserOrgAndRole } from '../_shared/auth-v2.ts';
import { canAddUser } from '../_shared/user-limits.ts';
import { PlanTier } from '../_shared/quotas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteUserRequest {
  email: string;
  role: 'member' | 'admin';
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
        JSON.stringify({ error: 'Only organization owners can invite users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, role: invitedRole }: InviteUserRequest = await req.json();

    if (!email || !invitedRole) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, domain, verified_at')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('Error fetching organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user limit for the tier
    const tierCheck = await canAddUser(supabase, orgId, (org.subscription_tier || 'free') as PlanTier);
    
    if (!tierCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: tierCheck.reason,
          currentCount: tierCheck.currentCount,
          limit: tierCheck.limit,
          upgradeRequired: true
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If domain is verified, check email domain matches
    if (org.verified_at && org.domain) {
      const invitedEmailDomain = email.split('@')[1].toLowerCase();
      if (invitedEmailDomain !== org.domain.toLowerCase()) {
        return new Response(
          JSON.stringify({ 
            error: `Only users with @${org.domain} email addresses can be invited to this organization`
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user already exists in this org
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('org_id', orgId)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User is already a member of this organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabase
      .from('domain_invitations')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'An invitation has already been sent to this email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user ID for invited_by
    const { data: { user } } = await userSupabase.auth.getUser();

    // Generate unique token for invitation
    const token = crypto.randomUUID();

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('domain_invitations')
      .insert({
        org_id: orgId,
        email: email.toLowerCase(),
        status: 'pending',
        invited_by: user?.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        domain_verified_at_invite: org.verified_at,
        metadata: { role: invitedRole }
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Invitation created for ${email} to org ${orgId} with role ${invitedRole}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          expires_at: invitation.expires_at,
          role: invitedRole
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in invite-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
