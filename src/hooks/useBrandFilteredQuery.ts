import { useBrand } from '@/contexts/BrandContext';

/**
 * Hook to add brand filtering to Supabase queries
 * Returns a filter function that can be applied to any query
 */
export function useBrandFilteredQuery() {
  const { selectedBrand } = useBrand();

  /**
   * Apply brand filtering to a Supabase query
   * If a brand is selected, filters by brand_id
   * If no brand selected, shows all data for the org
   */
  const applyBrandFilter = <T extends { brand_id?: string | null }>(
    query: any
  ) => {
    if (selectedBrand && selectedBrand.id && selectedBrand.id !== 'null') {
      // When brand is selected, show data for that brand OR unassigned data
      return query.or(`brand_id.eq.${selectedBrand.id},brand_id.is.null`);
    }
    // When no brand selected, show all data
    return query;
  };

  return {
    selectedBrand,
    applyBrandFilter,
    brandId: selectedBrand?.id || null,
  };
}
