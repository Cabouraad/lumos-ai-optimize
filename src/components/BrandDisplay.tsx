import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface BrandDisplayProps {
  brandName: string;
  brandDomain?: string;
  collapsed?: boolean;
  size?: 'default' | 'large';
}

export function BrandDisplay({ brandName, brandDomain, collapsed = false, size = 'default' }: BrandDisplayProps) {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState(false);

  // Generate logo URLs using actual domain if available
  useEffect(() => {
    if (!brandName) return;
    
    // Use provided domain or construct from name
    const domain = brandDomain || `${brandName.toLowerCase().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}.com`;
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    setLogoUrl(clearbitUrl);
    setLogoError(false);
  }, [brandName, brandDomain]);

  const handleLogoError = () => {
    if (!logoError) {
      setLogoError(true);
      // Fallback to UI Avatars with brand colors - adjust size based on prop
      const avatarSize = size === 'large' ? 64 : 40;
      setLogoUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&size=${avatarSize}&background=6366f1&color=ffffff&bold=true&format=svg`);
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

  // For large size (brand cards)
  if (size === 'large') {
    return (
      <div className="flex items-center gap-4">
        {/* Brand Logo */}
        <div className="w-16 h-16 rounded-lg bg-secondary/20 flex items-center justify-center border border-border/30 shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${brandName} logo`}
              className="w-14 h-14 rounded object-cover"
              onError={handleLogoError}
            />
          ) : (
            <Building2 className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        
        {/* Brand Name */}
        <h2 className="text-2xl font-semibold text-foreground break-words leading-tight">
          {brandName}
        </h2>
      </div>
    );
  }

  // Default size (sidebar/header)
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
          <h2 className="text-lg font-semibold text-foreground break-words leading-tight">
            {brandName}
          </h2>
        </div>
      </div>
    </div>
  );
}