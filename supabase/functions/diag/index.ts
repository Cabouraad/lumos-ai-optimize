import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowList = (Deno.env.get("APP_ORIGINS") ?? Deno.env.get("APP_ORIGIN") ?? "")
    .split(",").map(s=>s.trim()).filter(Boolean);
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