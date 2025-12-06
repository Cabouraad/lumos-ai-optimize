import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface VisibilityDrop {
  org_id: string;
  user_id: string;
  keyword_id: string;
  keyword: string;
  brand_name: string;
  prompt_text: string;
  previous_score: number;
  current_score: number;
  previous_rank: number;
  current_rank: number;
  previous_status: string;
  current_status: string;
  competitor_name: string;
  share_loss: number;
}

function generateDropEmailHtml(drop: VisibilityDrop, userName: string): string {
  const appUrl = Deno.env.get("APP_ORIGIN") || "https://llumos.ai";
  const dropPercentage = Math.round(drop.share_loss);
  
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
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Visibility Drop Detected</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Competitor ${drop.competitor_name || 'Unknown'} has taken your rank</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                Hi ${userName},
              </p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                We detected a <strong style="color: #dc2626;">negative shift</strong> in your AI Search Visibility for the keyword:
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; margin: 0 0 24px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #991b1b; font-size: 18px; font-weight: 600; margin: 0;">"${drop.keyword}"</p>
              </div>
              
              <!-- The Change Box -->
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                <h2 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">The Change:</h2>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Last Week:</span>
                      <span style="color: #059669; font-size: 16px; font-weight: 600; float: right;">Rank #${drop.previous_rank || 1} (${drop.previous_status})</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Today:</span>
                      <span style="color: #dc2626; font-size: 16px; font-weight: 600; float: right;">Rank #${drop.current_rank || 3} (${drop.current_status})</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- What Happened -->
              <div style="margin: 0 0 24px 0;">
                <h3 style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">What Happened:</h3>
                <p style="color: #374151; font-size: 16px; margin: 0;">
                  ChatGPT has updated its answer and is now prioritizing <strong style="color: #dc2626;">${drop.competitor_name || 'a competitor'}</strong> as the primary recommendation. Your brand sentiment has shifted from "${drop.previous_status}" to "${drop.current_status}."
                </p>
              </div>
              
              <!-- Impact Badge -->
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 0 0 32px 0; text-align: center;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                  <strong>Impact:</strong> You are losing approximately <span style="font-size: 20px; font-weight: 700;">${dropPercentage}%</span> of AI Share of Voice for this topic.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 32px 0;">
                <a href="${appUrl}/dashboard?utm_source=email&utm_medium=alert&utm_campaign=visibility_drop&keyword_id=${drop.keyword_id}" 
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
  console.log("[check-visibility-drops] Request received");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron secret for scheduled runs
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    
    if (cronSecret && cronSecret !== expectedSecret) {
      console.error("[check-visibility-drops] Invalid cron secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { 
      orgId = null,
      days = 7,
      threshold = 20,
      dryRun = false 
    } = body;

    console.log(`[check-visibility-drops] Checking drops: orgId=${orgId}, days=${days}, threshold=${threshold}%, dryRun=${dryRun}`);

    // Step 1 & 2: Query detect_visibility_drops function
    const { data: drops, error: dropsError } = await supabase.rpc('detect_visibility_drops', {
      p_org_id: orgId,
      p_days: days,
      p_threshold: threshold
    });

    if (dropsError) {
      console.error("[check-visibility-drops] Error detecting drops:", dropsError);
      throw dropsError;
    }

    if (!drops || drops.length === 0) {
      console.log("[check-visibility-drops] No visibility drops detected");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No visibility drops detected",
        dropsChecked: 0,
        emailsSent: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[check-visibility-drops] Found ${drops.length} visibility drops`);

    // Step 3 & 4: Process each drop and send emails
    let emailsSent = 0;
    const results: Array<{ keyword: string; email: string; status: string; error?: string }> = [];

    for (const drop of drops as VisibilityDrop[]) {
      try {
        // Get user email
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', drop.user_id)
          .single();

        if (!userData?.email) {
          console.log(`[check-visibility-drops] No email found for user ${drop.user_id}`);
          results.push({ keyword: drop.keyword, email: 'unknown', status: 'no_email' });
          continue;
        }

        // Check if we already sent an alert for this keyword recently (within 24h)
        const { data: recentAlerts } = await supabase
          .from('visibility_alerts')
          .select('id')
          .eq('keyword_id', drop.keyword_id)
          .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (recentAlerts && recentAlerts.length > 0) {
          console.log(`[check-visibility-drops] Alert already sent for keyword ${drop.keyword} within 24h`);
          results.push({ keyword: drop.keyword, email: userData.email, status: 'already_sent' });
          continue;
        }

        // Generate email
        const userName = drop.brand_name || 'there';
        const html = generateDropEmailHtml(drop, userName);
        const subject = `⚠️ Alert: ${drop.brand_name || 'Your brand'} visibility dropped on ChatGPT`;

        if (!dryRun) {
          // Send email via Resend
          const emailResponse = await resend.emails.send({
            from: "Llumos Alerts <alerts@llumos.ai>",
            to: [userData.email],
            subject,
            html,
          });

          console.log(`[check-visibility-drops] Email sent to ${userData.email}:`, emailResponse);

          // Log the alert
          await supabase.from('visibility_alerts').insert({
            org_id: drop.org_id,
            user_id: drop.user_id,
            keyword_id: drop.keyword_id,
            alert_type: 'visibility_drop',
            email_sent_to: userData.email,
            subject,
            drop_percentage: drop.share_loss,
            competitor_name: drop.competitor_name,
            metadata: {
              previous_score: drop.previous_score,
              current_score: drop.current_score,
              previous_rank: drop.previous_rank,
              current_rank: drop.current_rank,
            }
          });

          emailsSent++;
          results.push({ keyword: drop.keyword, email: userData.email, status: 'sent' });
        } else {
          console.log(`[check-visibility-drops] Dry run - would send to ${userData.email}`);
          results.push({ keyword: drop.keyword, email: userData.email, status: 'dry_run' });
        }
      } catch (emailError: any) {
        console.error(`[check-visibility-drops] Error processing drop for ${drop.keyword}:`, emailError);
        results.push({ keyword: drop.keyword, email: 'error', status: 'failed', error: emailError.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dropsDetected: drops.length,
      emailsSent,
      dryRun,
      results 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[check-visibility-drops] Error:", error);
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
