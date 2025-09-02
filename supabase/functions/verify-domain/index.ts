import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getUserOrgId } from '../_shared/auth.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Verify authentication and get user's org ID
    const orgId = await getUserOrgId(supabase);

    const { action, method } = await req.json();
    console.log('Domain verification request:', { action, method, orgId });

    if (action === 'verify') {
      return await verifyDomain(supabase, orgId, method);
    } else if (action === 'regenerate') {
      return await regenerateToken(supabase, orgId);
    } else {
      throw new Error('Invalid action. Use "verify" or "regenerate"');
    }

  } catch (error: any) {
    console.error('Domain verification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function verifyDomain(supabase: any, orgId: string, method: 'dns' | 'file'): Promise<Response> {
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

    console.log(`Verifying domain ${org.domain} using ${method} method`);

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

      console.log(`✅ Domain ${org.domain} verified successfully via ${method}`);
      
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
      console.log(`❌ Domain ${org.domain} verification failed via ${method}`);
      
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
    console.error('Domain verification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function regenerateToken(supabase: any, orgId: string): Promise<Response> {
  try {
    // Generate new verification token
    const { data: newToken, error } = await supabase.rpc('generate_verification_token', {
      org_id: orgId
    });

    if (error) {
      throw new Error(`Failed to generate token: ${error.message}`);
    }

    console.log(`Generated new verification token for org ${orgId}`);

    return new Response(
      JSON.stringify({
        success: true,
        token: newToken,
        message: 'New verification token generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Token regeneration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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
    console.log(`Checking DNS TXT record: ${recordName}`);
    
    // Use DNS over HTTPS (DoH) with Cloudflare
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${recordName}&type=TXT`;
    
    const response = await fetch(dohUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    if (!response.ok) {
      console.error(`DNS query failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const dnsData = await response.json();
    console.log('DNS response:', dnsData);

    if (dnsData.Status !== 0 || !dnsData.Answer) {
      console.log('No DNS records found or DNS error');
      return false;
    }

    // Check if any TXT record contains our token
    for (const record of dnsData.Answer) {
      if (record.type === 16) { // TXT record type
        const txtValue = record.data.replace(/"/g, ''); // Remove quotes
        console.log(`Found TXT record: ${txtValue}`);
        
        if (txtValue === expectedToken) {
          console.log('✅ DNS verification successful');
          return true;
        }
      }
    }

    console.log('❌ Token not found in DNS records');
    return false;

  } catch (error) {
    console.error('DNS verification error:', error);
    return false;
  }
}

async function verifyHTTPFile(fileUrl: string, expectedToken: string): Promise<boolean> {
  try {
    console.log(`Checking HTTP file: ${fileUrl}`);

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Llumos-Domain-Verifier/1.0'
      }
    });

    if (!response.ok) {
      console.error(`HTTP file check failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const content = await response.text();
    const trimmedContent = content.trim();
    
    console.log(`File content: "${trimmedContent}"`);
    console.log(`Expected token: "${expectedToken}"`);

    if (trimmedContent === expectedToken) {
      console.log('✅ HTTP file verification successful');
      return true;
    } else {
      console.log('❌ File content does not match token');
      return false;
    }

  } catch (error) {
    console.error('HTTP file verification error:', error);
    return false;
  }
}