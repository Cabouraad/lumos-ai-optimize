import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Brand {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface BrandContextType {
  selectedBrand: Brand | null;
  setSelectedBrand: (brand: Brand | null) => void;
  clearSelectedBrand: () => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const SELECTED_BRAND_KEY = 'llumos_selected_brand';

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [selectedBrand, setSelectedBrandState] = useState<Brand | null>(null);
  const [isValidated, setIsValidated] = useState(false);

  // Validate and load selected brand from localStorage
  useEffect(() => {
    const validateStoredBrand = async () => {
      const stored = localStorage.getItem(SELECTED_BRAND_KEY);
      if (!stored) {
        setIsValidated(true);
        return;
      }

      try {
        const storedBrand = JSON.parse(stored) as Brand;
        
        // Get current user's org_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          localStorage.removeItem(SELECTED_BRAND_KEY);
          setIsValidated(true);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single();

        // Validate the stored brand belongs to the current user's org
        if (userData?.org_id && storedBrand.org_id === userData.org_id) {
          // Verify brand still exists in database
          const { data: brandExists } = await supabase
            .from('brands')
            .select('id')
            .eq('id', storedBrand.id)
            .eq('org_id', userData.org_id)
            .single();

          if (brandExists) {
            setSelectedBrandState(storedBrand);
          } else {
            // Brand no longer exists, clear it
            localStorage.removeItem(SELECTED_BRAND_KEY);
          }
        } else {
          // Brand doesn't belong to current org, clear it
          localStorage.removeItem(SELECTED_BRAND_KEY);
        }
      } catch (e) {
        console.error('Failed to validate stored brand:', e);
        localStorage.removeItem(SELECTED_BRAND_KEY);
      }
      
      setIsValidated(true);
    };

    validateStoredBrand();
  }, []);

  const setSelectedBrand = (brand: Brand | null) => {
    setSelectedBrandState(brand);
    if (brand) {
      localStorage.setItem(SELECTED_BRAND_KEY, JSON.stringify(brand));
    } else {
      localStorage.removeItem(SELECTED_BRAND_KEY);
    }
  };

  const clearSelectedBrand = () => {
    setSelectedBrandState(null);
    localStorage.removeItem(SELECTED_BRAND_KEY);
  };

  return (
    <BrandContext.Provider value={{ selectedBrand, setSelectedBrand, clearSelectedBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within BrandProvider');
  }
  return context;
}
