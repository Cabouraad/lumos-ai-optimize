
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getCompetitorsData() {
  try {
    const orgId = await getOrgId();
    
    // Get competitor brands from database using proper foreign key relationship
    const { data: competitorBrands } = await supabase
      .from('brand_catalog')
      .select(`
        *,
        organizations!brand_catalog_org_id_fkey (name)
      `)
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .order('total_appearances', { ascending: false });
    
    // Allowlist for legitimate brands that should never be filtered
    const allowlistedBrands = [
      'google analytics', 'hubspot', 'buffer', 'hootsuite', 'coschedule', 
      'sprout social', 'buzzsumo', 'marketo', 'semrush', 'contentcal',
      'mailchimp', 'salesforce', 'adobe analytics', 'canva', 'later'
    ];

    // Transform data for UI with light post-filtering
    const transformedData = competitorBrands?.map(brand => ({
      id: brand.id,
      name: brand.name,
      totalAppearances: brand.total_appearances || 0,
      averageScore: Math.round((brand.average_score || 0) * 10) / 10, // Keep proper 0-10 scale
      firstDetectedAt: brand.first_detected_at,
      lastSeenAt: brand.last_seen_at,
      sharePercentage: Math.min(100, Math.max(0, (brand.average_score || 0) * 10)), // Convert 0-10 to 0-100 for percentage
      trend: 0, // Trend calculation will be implemented with historical data
      isManuallyAdded: false
    }))
    .filter(brand => {
      // Keep allowlisted brands and reasonable looking brand names
      const isAllowlisted = allowlistedBrands.some(allowed => 
        brand.name.toLowerCase().includes(allowed) || allowed.includes(brand.name.toLowerCase())
      );
      const isReasonableName = brand.name.length > 2 && !/^(seo|marketing|social media)$/i.test(brand.name);
      return isAllowlisted || isReasonableName;
    }) || [];

    // Get organization name for "Your Brand" using the foreign key relationship
    const orgName = competitorBrands?.[0]?.organizations?.name || 'Your Brand';

    return {
      competitors: transformedData,
      yourBrandName: orgName
    };
  } catch (error) {
    console.error('Error fetching competitors data:', error);
    return { competitors: [], yourBrandName: 'Your Brand' };
  }
}
