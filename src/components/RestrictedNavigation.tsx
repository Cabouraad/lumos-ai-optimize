import { ReactNode } from 'react';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';

interface RestrictedNavigationProps {
  children: ReactNode;
  feature: 'competitors' | 'recommendations';
  className?: string;
}

export function RestrictedNavigation({ children, feature, className = '' }: RestrictedNavigationProps) {
  const { canAccessCompetitorAnalysis, canAccessRecommendations } = useSubscriptionGate();
  
  const accessCheck = feature === 'competitors' 
    ? canAccessCompetitorAnalysis()
    : canAccessRecommendations();

  const handleUpgrade = () => {
    window.location.href = '/pricing';
  };

  if (!accessCheck.hasAccess && !accessCheck.daysRemainingInTrial) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 opacity-50">
          {children}
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleUpgrade}
          className="text-xs px-2 py-1"
        >
          <Crown className="w-3 h-3 mr-1" />
          Upgrade
        </Button>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}