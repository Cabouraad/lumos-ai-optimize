import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get organization domain
    const { data: org } = await supabase
      .from('organizations')
      .select('domain, domain_locked_at')
      .eq('id', orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (org.domain_locked_at) {
      return new Response(JSON.stringify({ 
        success: true, 
        verified: true,
        message: 'Domain already verified' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create verification token (stored in recommendations table)
    let token;
    const { data: existingToken } = await supabase
      .from('recommendations')
      .select('rationale')
      .eq('org_id', orgId)
      .eq('type', 'site')
      .eq('title', 'DOMAIN_TOKEN')
      .maybeSingle();

    if (existingToken) {
      token = existingToken.rationale;
    } else {
      // Generate new token
      token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      await supabase
        .from('recommendations')
        .insert({
          org_id: orgId,
          type: 'site',
          title: 'DOMAIN_TOKEN',
          rationale: token,
          status: 'open'
        });
    }

    // Try file verification first
    try {
      const fileUrl = `https://${org.domain}/.well-known/llumos-verify.txt`;
      const fileResponse = await fetch(fileUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (fileResponse.ok) {
        const fileContent = await fileResponse.text();
        if (fileContent.trim() === token) {
          // Successful file verification
          await supabase
            .from('organizations')
            .update({
              domain_locked_at: new Date().toISOString(),
              domain_verification_method: 'file'
            })
            .eq('id', orgId);

          // Clean up token
          await supabase
            .from('recommendations')
            .delete()
            .eq('org_id', orgId)
            .eq('type', 'site')
            .eq('title', 'DOMAIN_TOKEN');

          return new Response(JSON.stringify({ 
            success: true, 
            verified: true,
            method: 'file',
            message: 'Domain verified successfully via file' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (fileError) {
      console.log('File verification failed:', fileError);
    }

    // Try DNS verification (if available)
    try {
      // Note: Deno.resolveDns may not be available in all environments
      if (typeof Deno.resolveDns === 'function') {
        const dnsRecords = await Deno.resolveDns(`_llumos-verify.${org.domain}`, 'TXT');
        
        for (const record of dnsRecords) {
          if (record === token) {
            // Successful DNS verification
            await supabase
              .from('organizations')
              .update({
                domain_locked_at: new Date().toISOString(),
                domain_verification_method: 'dns'
              })
              .eq('id', orgId);

            // Clean up token
            await supabase
              .from('recommendations')
              .delete()
              .eq('org_id', orgId)
              .eq('type', 'site')
              .eq('title', 'DOMAIN_TOKEN');

            return new Response(JSON.stringify({ 
              success: true, 
              verified: true,
              method: 'dns',
              message: 'Domain verified successfully via DNS' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    } catch (dnsError) {
      console.log('DNS verification failed or not available:', dnsError);
    }

    // Verification failed
    return new Response(JSON.stringify({ 
      success: true, 
      verified: false,
      token: token,
      message: 'Domain verification failed. Please ensure the verification file is placed correctly.',
      instructions: {
        file: {
          path: `/.well-known/llumos-verify.txt`,
          content: token,
          url: `https://${org.domain}/.well-known/llumos-verify.txt`
        },
        dns: {
          record: `_llumos-verify.${org.domain}`,
          type: 'TXT',
          value: token
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Domain verification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});