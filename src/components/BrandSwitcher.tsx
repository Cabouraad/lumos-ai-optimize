import { useState, useEffect } from 'react';
import { Building2, Check, ChevronDown, Eye } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Brand {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface BrandSwitcherProps {
  brands: Brand[];
  collapsed?: boolean;
}

export function BrandSwitcher({ brands, collapsed = false }: BrandSwitcherProps) {
  const { selectedBrand, setSelectedBrand } = useBrand();
  const navigate = useNavigate();
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  // Generate logo URLs for all brands using their actual domain
  useEffect(() => {
    const urls: Record<string, string> = {};
    brands.forEach((brand) => {
      const clearbitUrl = `https://logo.clearbit.com/${brand.domain}`;
      urls[brand.id] = clearbitUrl;
    });
    setLogoUrls(urls);
  }, [brands]);

  const handleLogoError = (brandId: string, brandName: string) => {
    if (!logoErrors[brandId]) {
      setLogoErrors({ ...logoErrors, [brandId]: true });
      setLogoUrls({
        ...logoUrls,
        [brandId]: `https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&size=40&background=6366f1&color=ffffff&bold=true&format=svg`
      });
    }
  };

  const renderLogo = (brand: Brand, size: 'sm' | 'md' = 'md') => {
    const logoUrl = logoUrls[brand.id];
    const sizeClasses = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
    
    return (
      <div className={`${sizeClasses} rounded-lg bg-secondary/20 flex items-center justify-center border border-border/30 shadow-sm flex-shrink-0`}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${brand.name} logo`}
            className={`${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} rounded object-cover`}
            onError={() => handleLogoError(brand.id, brand.name)}
          />
        ) : (
          <Building2 className={`${iconSize} text-muted-foreground`} />
        )}
      </div>
    );
  };

  if (collapsed) {
    return (
      <div className="px-2 py-3 border-b border-border/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-10 hover:bg-accent/50"
            >
              {selectedBrand ? renderLogo(selectedBrand, 'sm') : <Building2 className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 bg-popover border-border/50 z-50 p-2">
            {brands.slice(0, 9).map((brand, index) => (
              <DropdownMenuItem
                key={brand.id}
                onClick={() => setSelectedBrand(brand)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md hover:bg-accent/50 focus:bg-accent/50"
              >
                {renderLogo(brand, 'sm')}
                <span className="flex-1 truncate text-sm">{brand.name}</span>
                <span className="text-xs text-muted-foreground font-mono">⌘{index + 1}</span>
              </DropdownMenuItem>
            ))}
            {brands.length > 0 && (
              <>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
                  onClick={() => navigate('/brands')}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md hover:bg-accent/50 focus:bg-accent/50"
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">View All</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 border-b border-border/30">
      <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
        Brand
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 py-1.5 h-auto hover:bg-accent/50 rounded-md"
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedBrand && renderLogo(selectedBrand, 'sm')}
              <span className="text-sm font-medium truncate">
                {selectedBrand?.name || 'Select Brand'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 bg-popover border-border/50 z-50 p-2">
          {brands.slice(0, 9).map((brand, index) => (
            <DropdownMenuItem
              key={brand.id}
              onClick={() => setSelectedBrand(brand)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md hover:bg-accent/50 focus:bg-accent/50"
            >
              {renderLogo(brand, 'sm')}
              <span className="flex-1 truncate text-sm">{brand.name}</span>
              <span className="text-xs text-muted-foreground font-mono">⌘{index + 1}</span>
            </DropdownMenuItem>
          ))}
          {brands.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                onClick={() => navigate('/brands')}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md hover:bg-accent/50 focus:bg-accent/50"
              >
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-sm">View All</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
