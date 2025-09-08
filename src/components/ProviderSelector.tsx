import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { getAllowedProviders } from '@/lib/providers/tier-policy';
import { useNavigate } from 'react-router-dom';

interface ProviderSelectorProps {
  selectedProviders: string[];
  onProviderChange: (providers: string[]) => void;
  className?: string;
}

const PROVIDER_INFO = {
  openai: { 
    label: 'OpenAI',
    description: 'GPT-4 powered responses',
    icon: '🤖'
  },
  perplexity: { 
    label: 'Perplexity', 
    description: 'Real-time web search',
    icon: '🔍'  
  },
  gemini: { 
    label: 'Gemini',
    description: 'Google\'s advanced AI',
    icon: '✨'
  }
};

export function ProviderSelector({ selectedProviders, onProviderChange, className = '' }: ProviderSelectorProps) {
  const { currentTier, limits } = useSubscriptionGate();
  const navigate = useNavigate();
  
  const allowedProviders = limits.allowedProviders || getAllowedProviders(currentTier as any);
  
  const handleProviderToggle = (providerId: string, checked: boolean) => {
    if (checked) {
      onProviderChange([...selectedProviders, providerId]);
    } else {
      onProviderChange(selectedProviders.filter(id => id !== providerId));
    }
  };

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Select AI Providers</h4>
          <Badge variant="outline" className="text-xs">
            {currentTier} plan
          </Badge>
        </div>
        
        <div className="space-y-3">
          {Object.entries(PROVIDER_INFO).map(([providerId, info]) => {
            const isAllowed = allowedProviders.includes(providerId);
            const isSelected = selectedProviders.includes(providerId);
            
            return (
              <div
                key={providerId}
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  isAllowed 
                    ? 'border-border hover:bg-muted/50' 
                    : 'border-muted bg-muted/20 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isAllowed ? (
                    <Checkbox
                      id={providerId}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleProviderToggle(providerId, checked as boolean)}
                    />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <div>
                      <label 
                        htmlFor={isAllowed ? providerId : undefined}
                        className={`text-sm font-medium ${
                          isAllowed ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        {info.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {info.description}
                      </p>
                    </div>
                  </div>
                </div>

                {!isAllowed && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleUpgrade}
                    className="text-xs px-2 py-1 h-6"
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground">
        {currentTier === 'starter' && (
          <p>
            🚀 <strong>Upgrade to Growth</strong> to access Gemini AI and unlock advanced features.{' '}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleUpgrade}>
              View plans
            </Button>
          </p>
        )}
        {currentTier === 'growth' && (
          <p>✨ All AI providers available on your Growth plan!</p>
        )}
        {currentTier === 'pro' && (
          <p>🏆 All AI providers available on your Pro plan!</p>
        )}
      </div>
    </div>
  );
}