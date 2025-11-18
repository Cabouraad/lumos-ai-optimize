// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function logReportEvent(orgId: string, weekKey: string, stage: string, message: string, data?: any) {
  try {
    await sb.from("report_events").insert({ org_id: orgId, week_key: weekKey, stage, message, data });
  } catch (_e) { 
    // best-effort logging, don't fail the report generation
  }
}
