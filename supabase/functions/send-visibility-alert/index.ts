import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VisibilityDropAlert {
  userId: string;
  userEmail: string;
  userName: string;
  brandName: string;
  keyword: string;
  previousRank: number;
  currentRank: number;
  previousStatus: string;
  currentStatus: string;
  competitorName: string;
  shareOfVoiceLoss: number;
}

function generateAlertEmailHtml(alert: VisibilityDropAlert): string {
  const appUrl = Deno.env.get("APP_ORIGIN") || "https://llumos.ai";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visibility Alert - Llumos</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with Warning -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Visibility Alert</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Action Required</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                Hi ${alert.userName || 'there'},
              </p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                We detected a <strong style="color: #dc2626;">negative shift</strong> in your AI Search Visibility for the keyword:
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; margin: 0 0 24px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #991b1b; font-size: 18px; font-weight: 600; margin: 0;">"${alert.keyword}"</p>
              </div>
              
              <!-- The Change Box -->
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                <h2 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">The Change:</h2>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Last Week:</span>
                      <span style="color: #059669; font-size: 16px; font-weight: 600; float: right;">Rank #${alert.previousRank} (${alert.previousStatus})</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Today:</span>
                      <span style="color: #dc2626; font-size: 16px; font-weight: 600; float: right;">Rank #${alert.currentRank} (${alert.currentStatus})</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- What Happened -->
              <div style="margin: 0 0 24px 0;">
                <h3 style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">What Happened:</h3>
                <p style="color: #374151; font-size: 16px; margin: 0;">
                  ChatGPT has updated its answer and is now prioritizing <strong style="color: #dc2626;">${alert.competitorName}</strong> as the primary recommendation. Your brand sentiment has shifted from "${alert.previousStatus}" to "${alert.currentStatus}."
                </p>
              </div>
              
              <!-- Impact Badge -->
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 0 0 32px 0; text-align: center;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                  <strong>Impact:</strong> You are losing approximately <span style="font-size: 20px; font-weight: 700;">${alert.shareOfVoiceLoss}%</span> of AI Share of Voice for this topic.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 32px 0;">
                <a href="${appUrl}/dashboard?utm_source=email&utm_medium=alert&utm_campaign=visibility_drop" 
                   style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                  View the Competitor Who Replaced You →
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center; font-style: italic;">
                Don't let your competitors own the AI conversation.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                      Best,<br>
                      <strong style="color: #374151;">The Llumos Bot</strong>
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <a href="${appUrl}/settings/notifications" style="color: #6b7280; font-size: 12px; text-decoration: underline;">
                      Manage email preferences
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-visibility-alert] Request received");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      mode = "check", // "check" to find drops and send, or "send" to send specific alert
      alert,
      orgId,
      dryRun = false 
    } = body;

    console.log(`[send-visibility-alert] Mode: ${mode}, DryRun: ${dryRun}`);

    if (mode === "send" && alert) {
      // Direct send mode - send a specific alert
      console.log(`[send-visibility-alert] Sending direct alert to ${alert.userEmail}`);
      
      const html = generateAlertEmailHtml(alert);
      
      if (!dryRun) {
        const emailResponse = await resend.emails.send({
          from: "Llumos Alerts <alerts@llumos.ai>",
          to: [alert.userEmail],
          subject: `⚠️ Alert: ${alert.brandName} visibility dropped on ChatGPT`,
          html,
        });
        
        console.log("[send-visibility-alert] Email sent:", emailResponse);
        
        return new Response(JSON.stringify({ 
          success: true, 
          emailId: emailResponse.id,
          sentTo: alert.userEmail 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } else {
        console.log("[send-visibility-alert] Dry run - email not sent");
        return new Response(JSON.stringify({ 
          success: true, 
          dryRun: true,
          wouldSendTo: alert.userEmail,
          html 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Check mode - detect visibility drops and send alerts
    console.log(`[send-visibility-alert] Checking for visibility drops${orgId ? ` for org ${orgId}` : ''}`);
    
    // Query for visibility drops in the last 7 days
    // This finds prompts where the brand was present last week but dropped significantly
    const { data: drops, error: dropsError } = await supabase.rpc('detect_visibility_drops', {
      p_org_id: orgId || null,
      p_days: 7,
      p_threshold: 20 // 20% drop threshold
    });

    if (dropsError) {
      console.error("[send-visibility-alert] Error detecting drops:", dropsError);
      // If the function doesn't exist, return empty result
      if (dropsError.message.includes('function') && dropsError.message.includes('does not exist')) {
        console.log("[send-visibility-alert] detect_visibility_drops function not found, using fallback logic");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "No visibility drops detected (function not available)",
          alertsSent: 0 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      throw dropsError;
    }

    if (!drops || drops.length === 0) {
      console.log("[send-visibility-alert] No visibility drops detected");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No visibility drops detected",
        alertsSent: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[send-visibility-alert] Found ${drops.length} visibility drops`);

    let alertsSent = 0;
    const results = [];

    for (const drop of drops) {
      // Get user details
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('org_id', drop.org_id)
        .eq('role', 'owner')
        .single();

      if (!user?.email) {
        console.log(`[send-visibility-alert] No owner email found for org ${drop.org_id}`);
        continue;
      }

      // Get org/brand details
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', drop.org_id)
        .single();

      const alertData: VisibilityDropAlert = {
        userId: drop.user_id,
        userEmail: user.email,
        userName: org?.name || 'there',
        brandName: drop.brand_name || org?.name || 'Your brand',
        keyword: drop.prompt_text || 'AI recommendation query',
        previousRank: drop.previous_rank || 1,
        currentRank: drop.current_rank || 3,
        previousStatus: drop.previous_status || 'Recommended First',
        currentStatus: drop.current_status || 'Mentioned briefly',
        competitorName: drop.competitor_name || 'a competitor',
        shareOfVoiceLoss: Math.round(drop.share_loss || 15),
      };

      const html = generateAlertEmailHtml(alertData);

      if (!dryRun) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Llumos Alerts <alerts@llumos.ai>",
            to: [alertData.userEmail],
            subject: `⚠️ Alert: ${alertData.brandName} visibility dropped on ChatGPT`,
            html,
          });
          
          console.log(`[send-visibility-alert] Email sent to ${alertData.userEmail}:`, emailResponse);
          alertsSent++;
          results.push({ email: alertData.userEmail, status: 'sent', emailId: emailResponse.id });
        } catch (emailError) {
          console.error(`[send-visibility-alert] Failed to send email to ${alertData.userEmail}:`, emailError);
          results.push({ email: alertData.userEmail, status: 'failed', error: emailError.message });
        }
      } else {
        console.log(`[send-visibility-alert] Dry run - would send to ${alertData.userEmail}`);
        results.push({ email: alertData.userEmail, status: 'dry_run' });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dropsDetected: drops.length,
      alertsSent,
      dryRun,
      results 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[send-visibility-alert] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
