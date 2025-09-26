import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRequestLogging } from "../_shared/observability/structured-logger.ts";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  name: string;
  domain: string;
  industry?: string;
  keywords?: string;
  competitors?: string;
  business_description?: string;
  products_services?: string;
  target_audience?: string;
};

function getJwtSubAndEmail(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob((token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: payload.sub as string | undefined, email: payload.email || payload.user_metadata?.email || null };
  } catch {
    return { userId: undefined, email: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  return withRequestLogging("onboarding", req, async (logger) => {

  const { userId, email } = getJwtSubAndEmail(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { name, domain, industry, keywords, competitors, business_description, products_services, target_audience }: Body = await req.json().catch(() => ({}));
  if (!name || !domain) {
    return new Response(JSON.stringify({ error: "Missing name/domain" }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(url, serviceKey);

  const normDomain = domain.trim().toLowerCase();

  try {
    logger.info("Creating organization", { 
      userId, 
      metadata: { name, domain: normDomain } 
    });

    // 1) Create organization (insert requires service role by trigger)
    const { data: org, error: orgErr } = await supa
      .from("organizations")
      .insert({
        name,
        domain: normDomain,
        plan_tier: "starter",
        domain_verification_method: "file",
        business_description: business_description || null,
        products_services: products_services || null,
        target_audience: target_audience || null,
        keywords: keywords ? keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []
      })
      .select()
      .single();

    if (orgErr) {
      logger.error("Error creating organization", orgErr);
      return new Response(JSON.stringify({ error: orgErr.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logger.info("Organization created", { metadata: { orgId: org.id } });

    // 2) Insert user row as owner (users table is write-locked to service role)
    const { error: userErr } = await supa
      .from("users")
      .insert({ 
        id: userId, 
        org_id: org.id, 
        role: "owner", 
        email: email ?? "unknown@example.com" 
      });

    // Allow idempotency if the row already exists
    if (userErr && !/duplicate key/i.test(userErr.message)) {
      console.error("Error creating user:", userErr);
      return new Response(JSON.stringify({ error: userErr.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logger.info("User record created/updated");

    // 3) Create organization's brand in catalog
    const { error: brandErr } = await supa
      .from("brand_catalog")
      .insert({
        org_id: org.id,
        name,
        variants_json: [],
        is_org_brand: true
      });

    if (brandErr) {
      console.error("Error creating brand catalog:", brandErr);
      return new Response(JSON.stringify({ error: brandErr.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logger.info("Brand catalog created");

    // 4) Ensure default providers exist (idempotent)
    const { error: providersErr } = await supa
      .from("llm_providers")
      .upsert([
        { name: "openai", enabled: true }, 
        { name: "perplexity", enabled: true }
      ], { 
        onConflict: "name" 
      });

    if (providersErr) {
      console.error("Error upserting providers:", providersErr);
      return new Response(JSON.stringify({ error: providersErr.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logger.info("Default providers ensured");

    return new Response(JSON.stringify({ ok: true, orgId: org.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    logger.error("Unexpected error in onboarding", error as Error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  });
});