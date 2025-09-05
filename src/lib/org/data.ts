import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export interface OrganizationKeywords {
  keywords: string[];
  competitors?: string[];
  products_services?: string;
  target_audience?: string;
  business_description?: string;
  business_city?: string;
  business_state?: string;
  business_country?: string;
  enable_localized_prompts?: boolean;
}

export async function getOrganizationKeywords(): Promise<OrganizationKeywords> {
  try {
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from("organizations")
      .select("keywords, competitors, products_services, target_audience, business_description, business_city, business_state, business_country, enable_localized_prompts")
      .eq("id", orgId)
      .single();

    if (error) throw error;

    return {
      keywords: data?.keywords || [],
      competitors: data?.competitors || [],
      products_services: data?.products_services || "",
      target_audience: data?.target_audience || "",
      business_description: data?.business_description || "",
      business_city: data?.business_city || "",
      business_state: data?.business_state || "",
      business_country: data?.business_country || "United States",
      enable_localized_prompts: data?.enable_localized_prompts || false,
    };
  } catch (error) {
    console.error("Error fetching organization keywords:", error);
    throw error;
  }
}

export async function updateOrganizationKeywords(keywords: Partial<OrganizationKeywords>) {
  try {
    // Use the secure RPC function instead of direct table update
    const { error } = await supabase.rpc('update_org_business_context', {
      p_keywords: keywords.keywords || null,
      p_competitors: keywords.competitors || null,
      p_products_services: keywords.products_services || null,
      p_target_audience: keywords.target_audience || null,
      p_business_description: keywords.business_description || null,
      p_business_city: keywords.business_city || null,
      p_business_state: keywords.business_state || null,
      p_business_country: keywords.business_country || null,
      p_enable_localized_prompts: keywords.enable_localized_prompts || null
    });

    if (error) {
      console.error("RPC function error:", error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating organization keywords:", error);
    throw error;
  }
}