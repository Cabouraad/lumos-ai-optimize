import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BrandDisplayProps {
  brandName: string;
  collapsed?: boolean;
}

export function BrandDisplay({ brandName, collapsed = false }: BrandDisplayProps) {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState(false);

  // Generate logo URLs
  useEffect(() => {
    if (!brandName) return;
    
    // Try Clearbit first (works well for many companies)
    const clearbitUrl = `https://logo.clearbit.com/${brandName.toLowerCase().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}.com`;
    setLogoUrl(clearbitUrl);
    setLogoError(false);
  }, [brandName]);

  const handleLogoError = () => {
    if (!logoError) {
      setLogoError(true);
      // Fallback to UI Avatars with brand colors
      setLogoUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&size=40&background=6366f1&color=ffffff&bold=true&format=svg`);
    }
  };

  if (collapsed) {
    return (
      <div className="flex justify-center p-2">
        <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center border border-border/30">
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={`${brandName} logo`}
              className="w-6 h-6 rounded object-cover"
              onError={handleLogoError}
            />
          ) : (
            <Building2 className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-b border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Brand Logo */}
        <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center border border-border/30 shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${brandName} logo`}
              className="w-8 h-8 rounded object-cover"
              onError={handleLogoError}
            />
          ) : (
            <Building2 className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        {/* Brand Name */}
        <div className="flex-1 min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className="text-lg font-semibold text-foreground truncate cursor-default">
                  {brandName}
                </h2>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-sm">{brandName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}