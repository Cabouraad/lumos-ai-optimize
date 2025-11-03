import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  email: string;
  domain: string;
  score: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, domain, score }: ReportRequest = await req.json();

    if (!email || !domain) {
      return new Response(
        JSON.stringify({ error: "Email and domain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store the report request
    const { error: insertError } = await supabase
      .from("visibility_report_requests")
      .insert({
        email,
        domain,
        score,
        status: "pending",
      });

    if (insertError) {
      console.error("Error storing report request:", insertError);
      throw insertError;
    }

    // TODO: In the future, trigger report generation and email sending here
    // For now, we'll just store the request
    console.log(`Visibility report requested for ${domain} by ${email} (score: ${score})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Report request received successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in request-visibility-report:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
