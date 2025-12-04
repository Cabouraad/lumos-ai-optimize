import { useBrand } from '@/contexts/BrandContext';

/**
 * Hook to add brand filtering to Supabase queries
 * Returns a filter function that can be applied to any query
 */
export function useBrandFilteredQuery() {
  const { selectedBrand } = useBrand();

  /**
   * Apply brand filtering to a Supabase query
   * If a brand is selected, filters by brand_id only (no NULL records)
   * If no brand selected, shows all data for the org
   */
  const applyBrandFilter = <T extends { brand_id?: string | null }>(
    query: any
  ) => {
    if (selectedBrand && selectedBrand.id && selectedBrand.id !== 'null') {
      // When brand is selected, show ONLY data for that brand
      return query.eq('brand_id', selectedBrand.id);
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
