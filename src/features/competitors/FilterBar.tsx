import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Props = {
  value: { days: number; providers: string[] };
  onChange: (v: { days: number; providers: string[] }) => void;
};

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'google_ai_overview', label: 'Google AIO' },
];

const TIME_WINDOWS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

/**
 * Filter bar for competitor analysis
 * Allows filtering by time window and AI provider
 */
export default function FilterBar({ value, onChange }: Props) {
  const [days, setDays] = useState(value.days);
  const [providers, setProviders] = useState<string[]>(value.providers);

  const toggleProvider = (providerId: string) => {
    setProviders(prev => 
      prev.includes(providerId) 
        ? prev.filter(p => p !== providerId) 
        : [...prev, providerId]
    );
  };

  const handleApply = () => {
    onChange({ days, providers });
  };

  const hasChanges = days !== value.days || 
    JSON.stringify(providers.sort()) !== JSON.stringify(value.providers.sort());

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Time Window:</span>
        <select
          className="bg-background border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
        >
          {TIME_WINDOWS.map(tw => (
            <option key={tw.value} value={tw.value}>
              {tw.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Providers:</span>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map(p => (
            <Badge
              key={p.id}
              variant={providers.includes(p.id) ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/90 transition-colors"
              onClick={() => toggleProvider(p.id)}
            >
              {p.label}
            </Badge>
          ))}
        </div>
      </div>

      <Button 
        size="sm"
        onClick={handleApply}
        disabled={!hasChanges}
        className="ml-auto"
      >
        Apply Filters
      </Button>
    </div>
  );
}
