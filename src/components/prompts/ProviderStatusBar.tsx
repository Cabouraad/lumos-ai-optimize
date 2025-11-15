import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Sparkles, Search, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProviderStatus {
  provider: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  brandPresent: boolean;
  score: number | null;
  hasData: boolean;
}

interface ProviderStatusBarProps {
  providers: {
    [key: string]: any;
  };
}

const PROVIDER_CONFIG = {
  openai: { name: 'ChatGPT', icon: Bot },
  gemini: { name: 'Gemini', icon: Sparkles },
  perplexity: { name: 'Perplexity', icon: Search },
  google_ai_overview: { name: 'Google AI', icon: Globe }
};

export function ProviderStatusBar({ providers }: ProviderStatusBarProps) {
  const statuses: ProviderStatus[] = Object.entries(PROVIDER_CONFIG).map(([key, config]) => {
    const providerData = providers[key];
    
    // Handle both single response and array of responses
    const responses = Array.isArray(providerData) ? providerData : (providerData ? [providerData] : []);
    const latestResponse = responses.find((r: any) => r?.status === 'completed' || r?.status === 'success');
    
    return {
      provider: key,
      name: config.name,
      icon: config.icon,
      brandPresent: latestResponse?.org_brand_present || false,
      score: latestResponse?.score || null,
      hasData: !!latestResponse
    };
  });

  const getStatusColor = (status: ProviderStatus) => {
    if (!status.hasData) return 'bg-muted';
    if (!status.brandPresent) return 'bg-destructive';
    if (status.score !== null) {
      if (status.score >= 8) return 'bg-success';
      if (status.score >= 5) return 'bg-warning';
      return 'bg-destructive';
    }
    return 'bg-muted';
  };

  const getTooltipContent = (status: ProviderStatus) => {
    if (!status.hasData) return `${status.name}: No data`;
    if (!status.brandPresent) return `${status.name}: Brand not visible`;
    if (status.score !== null) {
      return `${status.name}: Score ${status.score.toFixed(1)} • Brand visible`;
    }
    return `${status.name}: Brand visible`;
  };

  return (
    <div className="flex items-center gap-1.5">
      {statuses.map((status) => (
        <TooltipProvider key={status.provider}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative group cursor-help">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-all duration-200 group-hover:scale-125",
                  getStatusColor(status)
                )} />
                <status.icon className="h-3 w-3 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{getTooltipContent(status)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
