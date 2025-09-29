import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Entry validated: diag function entrypoint present
// Inlined CORS utility to avoid shared import packaging issues
function getStrictCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Get allowed origins from environment
  const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://llumos.app';
  const appOrigins = Deno.env.get('APP_ORIGINS');
  
  let allowedOrigins: string[];
  if (appOrigins) {
    allowedOrigins = appOrigins.split(',').map((origin: string) => origin.trim()).filter(Boolean);
  } else {
    // Default origins for development and production
    allowedOrigins = [appOrigin, 'http://localhost:5173', 'https://llumos.app'];
  }

  // For development environments, be more permissive
  const isDevelopment = requestOrigin?.includes('localhost') || 
                       requestOrigin?.includes('sandbox.lovable.dev') ||
                       requestOrigin?.includes('lovable.app') ||
                       requestOrigin?.includes('lovable.dev') ||
                       requestOrigin?.includes('lovableproject.com') ||
                       requestOrigin?.includes('127.0.0.1');
  
  let origin = '*'; // Default permissive for development
  
  if (!isDevelopment) {
    // In production, be strict about origins
    origin = requestOrigin && allowedOrigins.includes(requestOrigin) 
      ? requestOrigin 
      : allowedOrigins[0]; // Default to first allowed origin
  } else if (requestOrigin) {
    // For development, allow the specific origin
    origin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowList = (Deno.env.get("APP_ORIGINS") ?? Deno.env.get("APP_ORIGIN") ?? "")
    .split(",").map((s: string) => s.trim()).filter(Boolean);
  const allowed = allowList.includes(origin);
  
  const headers = {
    ...getStrictCorsHeaders(origin),
    "Content-Type": "application/json"
  };
  
  if (req.method === "OPTIONS") {
    console.log('📝 DIAG: Handling OPTIONS preflight request from:', origin);
    return new Response(null, { headers });
  }
  
  console.log('🔍 DIAG: Request from origin:', origin, 'Allowed:', allowed);
  
  const diagnosticData = {
    ok: true,
    origin,
    allowed,
    allowList,
    timestamp: new Date().toISOString(),
    environment: {
      hasAppOrigins: !!Deno.env.get("APP_ORIGINS"),
      hasAppOrigin: !!Deno.env.get("APP_ORIGIN"),
      hasCronSecret: !!Deno.env.get("CRON_SECRET"),
      hasE2EFakeProviders: Deno.env.get("E2E_FAKE_PROVIDERS") === "true"
    },
    cors: {
      method: req.method,
      requestHeaders: Object.fromEntries(req.headers.entries()),
      responseHeaders: headers
    }
  };
  
  return new Response(JSON.stringify(diagnosticData), { headers });
});