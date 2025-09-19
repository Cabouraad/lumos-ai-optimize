import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProviderName } from '@/lib/providers/tier-policy';

interface ProviderBadgeProps {
  provider: ProviderName;
  className?: string;
}

const providerConfig: Record<ProviderName, { label: string; color: string }> = {
  openai: { label: 'GPT', color: 'bg-green-100 text-green-800' },
  perplexity: { label: 'Perplexity', color: 'bg-blue-100 text-blue-800' },
  gemini: { label: 'Gemini', color: 'bg-purple-100 text-purple-800' },
  google_ai_overview: { label: 'G-AIO', color: 'bg-orange-100 text-orange-800' }
};

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider, className }) => {
  const config = providerConfig[provider];
  
  if (!config) {
    return null;
  }

  return (
    <Badge 
      variant="secondary" 
      className={`${config.color} ${className || ''}`}
    >
      {config.label}
    </Badge>
  );
};