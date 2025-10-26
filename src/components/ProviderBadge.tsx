import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProviderName } from '@/lib/providers/tier-policy';

interface ProviderBadgeProps {
  provider: ProviderName;
  className?: string;
  showCitationInfo?: boolean;
}

const providerConfig: Record<ProviderName, { label: string; color: string; citationSupport: boolean }> = {
  openai: { label: 'GPT', color: 'bg-green-100 text-green-800', citationSupport: false },
  perplexity: { label: 'Perplexity', color: 'bg-blue-100 text-blue-800', citationSupport: true },
  gemini: { label: 'Gemini', color: 'bg-purple-100 text-purple-800', citationSupport: true },
  google_ai_overview: { label: 'G-AIO', color: 'bg-orange-100 text-orange-800', citationSupport: true }
};

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider, className, showCitationInfo = false }) => {
  const config = providerConfig[provider];
  
  if (!config) {
    return null;
  }

  const badge = (
    <Badge 
      variant="secondary" 
      className={`${config.color} ${className || ''}`}
    >
      {config.label}
    </Badge>
  );

  // Show tooltip with citation support info if requested
  if (showCitationInfo && !config.citationSupport) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">No native citation support</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
};