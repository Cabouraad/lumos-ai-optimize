import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Clock, Crown } from 'lucide-react';

interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade?: () => void;
}

export function TrialBanner({ daysRemaining, onUpgrade }: TrialBannerProps) {
  const navigate = useNavigate();
  
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('/pricing');
    }
  };

  const urgencyLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';
  
  const bgColor = {
    critical: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  };

  const textColor = {
    critical: 'text-red-800 dark:text-red-200',
    warning: 'text-amber-800 dark:text-amber-200',
    info: 'text-blue-800 dark:text-blue-200'
  };

  return (
    <Alert className={`${bgColor[urgencyLevel]} mb-6`}>
      <Clock className={`h-4 w-4 ${textColor[urgencyLevel]}`} />
      <AlertDescription className={`flex items-center justify-between ${textColor[urgencyLevel]}`}>
        <span>
          <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</strong> in your free trial. 
          Card required; no charge during trial.
        </span>
        <Button 
          size="sm" 
          onClick={handleUpgrade}
          className="ml-4 bg-primary hover:bg-primary/90"
        >
          <Crown className="w-4 h-4 mr-1" />
          Upgrade
        </Button>
      </AlertDescription>
    </Alert>
  );
}