import { serve } from "https://deno.land/std/http/server.ts";

serve((req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowList = (Deno.env.get("APP_ORIGINS") ?? Deno.env.get("APP_ORIGIN") ?? "")
    .split(",").map(s=>s.trim()).filter(Boolean);
  const allowed = allowList.includes(origin);
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  return new Response(JSON.stringify({ ok:true, origin, allowed, allowList }), { headers });
});