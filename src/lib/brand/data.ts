import { supabase } from "@/integrations/supabase/client";

export interface BrandBusinessContext {
  keywords: string[];
  products_services?: string;
  target_audience?: string;
  business_description?: string;
}

export async function getBrandBusinessContext(brandId: string): Promise<BrandBusinessContext> {
  const { data, error } = await supabase
    .from("brands")
    .select("keywords, products_services, target_audience, business_description")
    .eq("id", brandId)
    .single();

  if (error) throw error;

  return {
    keywords: data?.keywords || [],
    products_services: data?.products_services || "",
    target_audience: data?.target_audience || "",
    business_description: data?.business_description || "",
  };
}

export async function updateBrandBusinessContext(
  brandId: string, 
  context: Partial<BrandBusinessContext>
): Promise<{ success: boolean }> {
  const updateData: Record<string, unknown> = {};
  
  if (context.keywords !== undefined) updateData.keywords = context.keywords;
  if (context.products_services !== undefined) updateData.products_services = context.products_services;
  if (context.target_audience !== undefined) updateData.target_audience = context.target_audience;
  if (context.business_description !== undefined) updateData.business_description = context.business_description;

  const { error } = await supabase
    .from("brands")
    .update(updateData)
    .eq("id", brandId);

  if (error) throw error;

  return { success: true };
}
