import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';

interface OrgBrand {
  name: string;
  variants_json?: string[];
}

export function useOrgBrands() {
  const [orgBrandVariants, setOrgBrandVariants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgBrands();
  }, []);

  const fetchOrgBrands = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const orgId = await getOrgId();
      if (!orgId) {
        setOrgBrandVariants([]);
        return;
      }

      const { data, error } = await supabase
        .from('brand_catalog')
        .select('name, variants_json')
        .eq('org_id', orgId)
        .eq('is_org_brand', true);

      if (error) {
        throw error;
      }

      // Flatten brand names and variants into a single array
      const variants = new Set<string>();
      
      for (const brand of data || []) {
        // Add main name
        variants.add(brand.name.toLowerCase());
        
        // Add variants if available
        if (brand.variants_json && Array.isArray(brand.variants_json)) {
          for (const variant of brand.variants_json) {
            if (typeof variant === 'string') {
              variants.add(variant.toLowerCase());
            }
          }
        }
        
        // Generate common variations
        const name = brand.name;
        variants.add(name.toLowerCase());
        variants.add(name.toUpperCase());
        
        // Add domain variations if it looks like a domain
        if (name.includes('.')) {
          variants.add(name.replace(/\.(com|io|org|net)$/i, ''));
        }
        
        // Add hyphenated and space variations
        if (name.includes(' ')) {
          variants.add(name.replace(/\s+/g, '-').toLowerCase());
          variants.add(name.replace(/\s+/g, '').toLowerCase());
        }
        if (name.includes('-')) {
          variants.add(name.replace(/-/g, ' ').toLowerCase());
          variants.add(name.replace(/-/g, '').toLowerCase());
        }
      }

      setOrgBrandVariants(Array.from(variants).filter(v => v.length >= 2));
    } catch (error) {
      console.error('Error fetching org brands:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch org brands');
      setOrgBrandVariants([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    orgBrandVariants,
    loading,
    error,
    refetch: fetchOrgBrands
  };
}