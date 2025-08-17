import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';

interface Filters {
  kind: string;
  status: string;
  minImpact: number;
  search: string;
}

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  totalCount?: number;
  filteredCount?: number;
}

export function FilterBar({ filters, onFiltersChange, totalCount = 0, filteredCount = 0 }: FilterBarProps) {
  const updateFilter = (key: keyof Filters, value: string | number) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground">Filters</h3>
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              ({filteredCount} of {totalCount})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search-input" className="text-sm font-medium">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-input"
                type="text"
                placeholder="Title or rationale..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10 bg-background border-input"
                aria-label="Search recommendations by title or rationale"
              />
            </div>
          </div>

          {/* Kind Filter */}
          <div className="space-y-2">
            <Label htmlFor="kind-select" className="text-sm font-medium">
              Type
            </Label>
            <Select
              value={filters.kind}
              onValueChange={(value) => updateFilter('kind', value)}
            >
              <SelectTrigger 
                id="kind-select" 
                className="bg-background border-input"
                aria-label="Filter by recommendation type"
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-background border-input shadow-lg z-50">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="content">📄 Content</SelectItem>
                <SelectItem value="social">📱 Social</SelectItem>
                <SelectItem value="site">🌐 Site</SelectItem>
                <SelectItem value="prompt">💡 Prompt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status-select" className="text-sm font-medium">
              Status
            </Label>
            <Select
              value={filters.status}
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger 
                id="status-select" 
                className="bg-background border-input"
                aria-label="Filter by recommendation status"
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-background border-input shadow-lg z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">🟢 Open</SelectItem>
                <SelectItem value="snoozed">🟡 Snoozed</SelectItem>
                <SelectItem value="done">✅ Done</SelectItem>
                <SelectItem value="dismissed">❌ Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Impact Filter */}
          <div className="space-y-2">
            <Label htmlFor="impact-slider" className="text-sm font-medium">
              Min Impact: {filters.minImpact}%
            </Label>
            <div className="pt-2">
              <Slider
                id="impact-slider"
                min={0}
                max={20}
                step={1}
                value={[filters.minImpact]}
                onValueChange={([value]) => updateFilter('minImpact', value)}
                className="w-full"
                aria-label={`Minimum impact filter: ${filters.minImpact}%`}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}