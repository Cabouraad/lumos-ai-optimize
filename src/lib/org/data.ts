import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export interface OrganizationKeywords {
  keywords: string[];
  products_services?: string;
  target_audience?: string;
  business_description?: string;
}

export async function getOrganizationKeywords(): Promise<OrganizationKeywords> {
  try {
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from("organizations")
      .select("keywords, products_services, target_audience, business_description")
      .eq("id", orgId)
      .single();

    if (error) throw error;

    return {
      keywords: data?.keywords || [],
      products_services: data?.products_services || "",
      target_audience: data?.target_audience || "",
      business_description: data?.business_description || "",
    };
  } catch (error) {
    console.error("Error fetching organization keywords:", error);
    throw error;
  }
}

export async function updateOrganizationKeywords(keywords: OrganizationKeywords) {
  try {
    const orgId = await getOrgId();

    const { error } = await supabase
      .from("organizations")
      .update({
        keywords: keywords.keywords,
        products_services: keywords.products_services,
        target_audience: keywords.target_audience,
        business_description: keywords.business_description,
      })
      .eq("id", orgId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error updating organization keywords:", error);
    throw error;
  }
}