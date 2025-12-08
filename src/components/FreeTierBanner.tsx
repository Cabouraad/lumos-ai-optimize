import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreeTierBannerProps {
  promptCount: number;
  maxPrompts: number;
}

export function FreeTierBanner({ promptCount, maxPrompts }: FreeTierBannerProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Free Tier</h3>
              <Badge variant="outline" className="text-xs">
                {promptCount}/{maxPrompts} prompts
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <Clock className="w-3 h-3 inline mr-1" />
              Your prompts are monitored weekly. Upgrade for daily monitoring and more prompts.
            </p>
          </div>
        </div>
        <Button 
          onClick={() => navigate('/pricing')} 
          size="sm"
          className="shrink-0 gap-2"
        >
          <Zap className="w-4 h-4" />
          Upgrade
        </Button>
      </div>
    </div>
  );
}
