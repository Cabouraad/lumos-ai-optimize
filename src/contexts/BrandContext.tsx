import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Load selected brand from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SELECTED_BRAND_KEY);
    if (stored) {
      try {
        setSelectedBrandState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored brand:', e);
        localStorage.removeItem(SELECTED_BRAND_KEY);
      }
    }
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
