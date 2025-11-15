import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Sparkles, Search, Globe } from 'lucide-react';

interface ScoreBreakdownTooltipProps {
  providers: {
    [key: string]: any;
  };
  avgScore: number;
  children: React.ReactNode;
}

const PROVIDER_CONFIG = {
  openai: { name: 'ChatGPT', icon: Bot },
  gemini: { name: 'Gemini', icon: Sparkles },
  perplexity: { name: 'Perplexity', icon: Search },
  google_ai_overview: { name: 'Google AI', icon: Globe }
};

export function ScoreBreakdownTooltip({ providers, avgScore, children }: ScoreBreakdownTooltipProps) {
  const providerScores = Object.entries(PROVIDER_CONFIG).map(([key, config]) => {
    const providerData = providers[key];
    const responses = Array.isArray(providerData) ? providerData : (providerData ? [providerData] : []);
    const latestResponse = responses.find((r: any) => r?.status === 'completed' || r?.status === 'success');
    
    return {
      name: config.name,
      icon: config.icon,
      score: latestResponse?.score || null,
      brandPresent: latestResponse?.org_brand_present || false
    };
  });

  const validScores = providerScores.filter(p => p.score !== null);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="text-xs font-medium border-b border-border pb-1.5">
              Score Breakdown
            </div>
            {providerScores.map((provider) => {
              const Icon = provider.icon;
              return (
                <div key={provider.name} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span>{provider.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.score !== null ? (
                      <>
                        <span className="font-medium">{provider.score.toFixed(1)}</span>
                        <span className={provider.brandPresent ? 'text-success' : 'text-destructive'}>
                          {provider.brandPresent ? '✓' : '✗'}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              );
            })}
            {validScores.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-border">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Average</span>
                  <span>{(avgScore * 10).toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
