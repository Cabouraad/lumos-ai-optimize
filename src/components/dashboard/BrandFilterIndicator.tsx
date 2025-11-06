import { useBrand } from '@/contexts/BrandContext';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

export function BrandFilterIndicator() {
  const { selectedBrand } = useBrand();

  if (!selectedBrand) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <Building2 className="h-3 w-3" />
      <span className="text-xs">Filtered by: {selectedBrand.name}</span>
    </Badge>
  );
}
