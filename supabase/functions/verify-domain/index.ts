import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getUserOrgId } from '../_shared/auth-v2.ts';
import { withRequestLogging } from '../_shared/observability/structured-logger.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withRequestLogging("verify-domain", req, async (logger) => {
    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Verify authentication and get user's org ID
    const orgId = await getUserOrgId(supabase);

    const { action, method } = await req.json();
    logger.info('Domain verification request', { 
      orgId, 
      metadata: { action, method } 
    });

    if (action === 'verify') {
      return await verifyDomain(supabase, orgId, method, logger);
    } else if (action === 'regenerate') {
      return await regenerateToken(supabase, orgId, logger);
    } else {
      throw new Error('Invalid action. Use "verify" or "regenerate"');
    }
  });
});

async function verifyDomain(supabase: any, orgId: string, method: 'dns' | 'file', logger: any): Promise<Response> {
  try {
    // Get organization data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('domain, verification_token, verified_at')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new Error('Organization not found');
    }

    if (!org.domain) {
      throw new Error('No domain configured for organization');
    }

    if (!org.verification_token) {
      throw new Error('No verification token found. Please regenerate token.');
    }

    logger.info('Verifying domain', {
      orgId,
      metadata: { domain: org.domain, method }
    });

    let verified = false;
    let verificationDetails = '';

    if (method === 'dns') {
      // Verify DNS TXT record
      const txtRecord = `_llumos-verify.${org.domain}`;
      verified = await verifyDNSRecord(txtRecord, org.verification_token);
      verificationDetails = `DNS TXT record: ${txtRecord}`;
    } else if (method === 'file') {
      // Verify HTTP file
      const fileUrl = `https://${org.domain}/.well-known/llumos-verify.txt`;
      verified = await verifyHTTPFile(fileUrl, org.verification_token);
      verificationDetails = `HTTP file: ${fileUrl}`;
    }

    if (verified) {
      // Mark domain as verified
      const { error: updateError } = await supabase.rpc('mark_domain_verified', {
        org_id: orgId
      });

      if (updateError) {
        throw new Error(`Failed to mark domain as verified: ${updateError.message}`);
      }

      logger.info('Domain verified successfully', {
        orgId,
        metadata: { domain: org.domain, method }
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Domain ${org.domain} verified successfully!`,
          method,
          verificationDetails,
          verifiedAt: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      logger.warn('Domain verification failed', {
        orgId,
        metadata: { domain: org.domain, method, verificationDetails }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Domain verification failed. Please ensure ${verificationDetails} contains the correct token.`,
          method,
          verificationDetails
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Domain verification error', errorObj);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorObj.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function regenerateToken(supabase: any, orgId: string, logger: any): Promise<Response> {
  try {
    // Generate new verification token
    const { data: newToken, error } = await supabase.rpc('generate_verification_token', {
      org_id: orgId
    });

    if (error) {
      throw new Error(`Failed to generate token: ${error.message}`);
    }

    logger.info('Generated new verification token', { orgId });

    return new Response(
      JSON.stringify({
        success: true,
        token: newToken,
        message: 'New verification token generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Token regeneration error', errorObj);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorObj.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function verifyDNSRecord(recordName: string, expectedToken: string): Promise<boolean> {
  try {
    // Use DNS over HTTPS (DoH) with Cloudflare
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${recordName}&type=TXT`;
    
    const response = await fetch(dohUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    if (!response.ok) {
      return false;
    }

    const dnsData = await response.json();

    if (dnsData.Status !== 0 || !dnsData.Answer) {
      return false;
    }

    // Check if any TXT record contains our token
    for (const record of dnsData.Answer) {
      if (record.type === 16) { // TXT record type
        const txtValue = record.data.replace(/"/g, ''); // Remove quotes
        
        if (txtValue === expectedToken) {
          return true;
        }
      }
    }

    return false;

  } catch (error: unknown) {
    return false;
  }
}

async function verifyHTTPFile(fileUrl: string, expectedToken: string): Promise<boolean> {
  try {
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Llumos-Domain-Verifier/1.0'
      }
    });

    if (!response.ok) {
      return false;
    }

    const content = await response.text();
    const trimmedContent = content.trim();

    if (trimmedContent === expectedToken) {
      return true;
    } else {
      return false;
    }

  } catch (error: unknown) {
    return false;
  }
}