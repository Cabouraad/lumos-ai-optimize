import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Delete account function invoked');
  
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting delete account process...');
    
    // Check environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
      hasStripeKey: !!stripeSecretKey,
      urlStart: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'missing'
    });

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !stripeSecretKey) {
      console.error('Missing required environment variables');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration error - missing environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get and validate authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    // Create Supabase clients
    console.log('Creating Supabase clients...');
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    console.log('Clients created, verifying user...');

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error('User verification failed:', userError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication failed: ' + userError.message
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user) {
      console.error('No user found');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User not found'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User verified: ${user.email} (${user.id})`);

    // Get user's organization info
    console.log('Fetching user organization data...');
    
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (userDataError) {
      console.error('Failed to fetch user data:', userDataError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch user data: ' + userDataError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User data:', userData);

    const orgId = userData?.org_id;
    const userRole = userData?.role;

    // Check if user is org owner with other members
    if (userRole === 'owner' && orgId) {
      console.log('Checking for other organization members...');
      
      const { data: otherUsers, error: otherUsersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .neq('id', user.id);

      if (otherUsersError) {
        console.error('Failed to check other users:', otherUsersError.message);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to verify organization status: ' + otherUsersError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (otherUsers && otherUsers.length > 0) {
        console.log(`Found ${otherUsers.length} other users in organization`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Cannot delete account: You are the organization owner and there are other users. Please transfer ownership first.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Starting data cleanup...');

    // Cancel Stripe subscriptions first
    console.log('Checking for Stripe subscriptions to cancel...');
    
    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
      
      // Get user's subscription data
      const { data: subscriberData, error: subscriberFetchError } = await supabaseAdmin
        .from('subscribers')
        .select('stripe_customer_id, stripe_subscription_id, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subscriberFetchError) {
        console.error('Error fetching subscriber data:', subscriberFetchError.message);
      } else if (subscriberData?.stripe_customer_id) {
        console.log(`Found Stripe customer: ${subscriberData.stripe_customer_id}`);
        
        // Get all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: subscriberData.stripe_customer_id,
          status: 'active'
        });

        console.log(`Found ${subscriptions.data.length} active subscriptions`);

        // Cancel all active subscriptions
        for (const subscription of subscriptions.data) {
          console.log(`Canceling subscription: ${subscription.id}`);
          try {
            await stripe.subscriptions.cancel(subscription.id, {
              invoice_now: false,
              prorate: false,
            });
            console.log(`Successfully canceled subscription: ${subscription.id}`);
          } catch (subError) {
            console.error(`Error canceling subscription ${subscription.id}:`, subError);
          }
        }

        // Also check for any upcoming invoices and void them
        try {
          const upcomingInvoices = await stripe.invoices.list({
            customer: subscriberData.stripe_customer_id,
            status: 'draft'
          });

          for (const invoice of upcomingInvoices.data) {
            console.log(`Voiding draft invoice: ${invoice.id}`);
            try {
              await stripe.invoices.voidInvoice(invoice.id);
              console.log(`Successfully voided invoice: ${invoice.id}`);
            } catch (invoiceError) {
              console.error(`Error voiding invoice ${invoice.id}:`, invoiceError);
            }
          }
        } catch (invoiceError) {
          console.error('Error handling invoices:', invoiceError);
        }

        console.log('Stripe subscription cancellation completed');
      } else {
        console.log('No Stripe customer found for this user');
      }
    } catch (stripeError) {
      console.error('Error during Stripe cleanup:', stripeError);
      // Continue with account deletion even if Stripe cleanup fails
    }

    // Clean up organization data if user has an org
    if (orgId) {
      console.log('Cleaning up organization-related data...');
      
      // Delete prompts and related data
      const { error: promptsError } = await supabaseAdmin
        .from('prompts')
        .delete()
        .eq('org_id', orgId);

      if (promptsError) {
        console.error('Error deleting prompts:', promptsError.message);
      }

      // Delete other org-related tables
      const cleanupTables = [
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
          console.error(`Error cleaning up ${table}:`, error.message);
        }
      }

      // Delete organization if user is owner
      if (userRole === 'owner') {
        console.log('Deleting organization...');
        const { error: orgError } = await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('id', orgId);

        if (orgError) {
          console.error('Error deleting organization:', orgError.message);
        }
      }
    }

    // Clean up user-specific data
    console.log('Cleaning up user-specific data...');
    
    const { error: subscriberError } = await supabaseAdmin
      .from('subscribers')
      .delete()
      .eq('user_id', user.id);

    if (subscriberError) {
      console.error('Error deleting subscriber data:', subscriberError.message);
    }

    const { error: userDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id);

    if (userDeleteError) {
      console.error('Error deleting user record:', userDeleteError.message);
    }

    // Finally, delete the auth user
    console.log('Deleting auth user...');
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to delete authentication record: ' + authDeleteError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Account deletion completed successfully!');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Account deleted successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Unexpected error in delete-account function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'An unexpected error occurred: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});