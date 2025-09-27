import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

interface EnsureUserResponse {
  success: boolean;
  user_id: string;
  email: string;
  existed: boolean;
  message?: string;
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token or user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { id: userId, email } = userData.user;

    if (!email) {
      return new Response(JSON.stringify({ error: "User email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check if user already exists in public.users
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing user:', checkError);
      return new Response(JSON.stringify({ error: "Database error while checking user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    let existed = false;

    if (!existingUser) {
      // User doesn't exist, create them
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            id: userId,
            email: email,
            role: 'member' // Default role
          }
        ]);

      if (insertError) {
        // Check if it's a duplicate key error (race condition)
        if (insertError.code === '23505') {
          console.log('User already exists (race condition), continuing...');
          existed = true;
        } else {
          console.error('Error inserting user:', insertError);
          return new Response(JSON.stringify({ error: "Failed to create user record" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          });
        }
      }
    } else {
      existed = true;
      
      // Update email if different (user might have changed it)
      if (existingUser.email !== email) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ email })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating user email:', updateError);
          // Don't fail the request for email update errors
        }
      }
    }

    const response: EnsureUserResponse = {
      success: true,
      user_id: userId,
      email: email,
      existed: existed,
      message: existed ? 'User record exists' : 'User record created'
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Ensure user record error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});