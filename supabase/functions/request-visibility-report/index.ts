import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  firstName: string;
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
    const { firstName, email, domain, score }: ReportRequest = await req.json();

    // Validate required fields
    if (!firstName?.trim() || !email?.trim() || !domain?.trim()) {
      return new Response(
        JSON.stringify({ error: "First name, email, and domain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate length limits
    if (firstName.length > 100 || email.length > 255 || domain.length > 255) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store the report request
    const { error: insertError } = await supabase
      .from("visibility_report_requests")
      .insert({
        email: email.trim(),
        domain: domain.trim(),
        score,
        status: "pending",
        metadata: { firstName: firstName.trim() },
      });

    if (insertError) {
      console.error("Error storing report request:", insertError);
      throw insertError;
    }

    // Send email notification to info@llumos.app
    if (RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
          from: "Llumos Reports <reports@llumos.app>",
          to: ["info@llumos.app"],
          subject: `New Visibility Report Request - ${domain}`,
          html: `
            <h2>New Visibility Report Request</h2>
            <p><strong>Name:</strong> ${firstName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Domain:</strong> ${domain}</p>
            <p><strong>Llumos Score:</strong> ${score}</p>
            <p><strong>Requested at:</strong> ${new Date().toISOString()}</p>
            <hr>
            <p><em>Please prepare and send the comprehensive visibility report to ${email}</em></p>
          `,
        });
        console.log(`Notification email sent to info@llumos.app for ${domain}`);
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the request if email fails
      }
    }

    console.log(`Visibility report requested for ${domain} by ${firstName} (${email}) - Score: ${score}`);

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
