import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getCompetitorsData() {
  try {
    const orgId = await getOrgId();
    
    // Get competitor brands from database
    const { data: competitorBrands } = await supabase
      .from('brand_catalog')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .order('total_appearances', { ascending: false });
    
    // Transform data for UI
    const transformedData = competitorBrands?.map(brand => ({
      id: brand.id,
      name: brand.name,
      totalAppearances: brand.total_appearances || 0,
      averageScore: Math.round((brand.average_score || 0) * 10), // Convert 0-10 to 0-100
      firstDetectedAt: brand.first_detected_at,
      lastSeenAt: brand.last_seen_at,
      sharePercentage: Math.min(100, Math.max(0, (brand.average_score || 0) * 10)),
      trend: Math.random() * 20 - 10, // TODO: Calculate actual trend from historical data
      isManuallyAdded: false
    })) || [];

    // Get organization name for "Your Brand"
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    return {
      competitors: transformedData,
      yourBrandName: orgData?.name || 'Your Brand'
    };
  } catch (error) {
    console.error('Error fetching competitors data:', error);
    return { competitors: [], yourBrandName: 'Your Brand' };
  }
}