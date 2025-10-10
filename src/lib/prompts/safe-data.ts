import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getSafePromptsData() {
  try {
    const orgId = await getOrgId();

    // Use maybeSingle for resilience and clearer errors when orgId is invalid
    const { data: prompts, error } = await supabase
      .from("prompts")
      .select("id, text, active, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return prompts ?? [];
  } catch (error) {
    console.error("Prompts data error:", error);
    throw error;
  }
}