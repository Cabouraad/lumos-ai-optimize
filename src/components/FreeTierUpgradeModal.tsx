import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreeTierUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  limitType: 'prompts' | 'features';
  currentCount?: number;
  maxCount?: number;
}

export function FreeTierUpgradeModal({ 
  open, 
  onClose, 
  limitType,
  currentCount = 5,
  maxCount = 5
}: FreeTierUpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate('/pricing');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <Badge variant="secondary">Free Tier</Badge>
          </div>
          <DialogTitle className="text-xl">
            {limitType === 'prompts' 
              ? 'Prompt Limit Reached' 
              : 'Feature Not Available'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {limitType === 'prompts' 
              ? `You've reached the ${maxCount} prompt limit on the Free tier. Upgrade to track more prompts with daily monitoring.`
              : 'This feature is not available on the Free tier. Upgrade to unlock all features.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <p className="font-medium text-sm text-foreground">Upgrade to Starter and get:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Track up to 25 prompts</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Daily prompt monitoring (not weekly)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>2 AI providers (ChatGPT + Perplexity)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Full visibility dashboard</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="gap-2">
            <Zap className="w-4 h-4" />
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
