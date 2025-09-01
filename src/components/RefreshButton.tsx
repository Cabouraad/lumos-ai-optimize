/**
 * Refresh button component with loading state and auto-refresh indicator
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  loading?: boolean;
  lastUpdated?: Date | null;
  autoRefreshEnabled?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showLastUpdated?: boolean;
}

export function RefreshButton({
  onRefresh,
  loading = false,
  lastUpdated,
  autoRefreshEnabled = true,
  className,
  size = 'sm',
  variant = 'outline',
  showLastUpdated = true
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || loading) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return `${seconds}s ago`;
  };

  const isLoading = loading || isRefreshing;

  return (
    <div className="flex items-center gap-2">
      {showLastUpdated && lastUpdated && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Badge 
            variant="outline" 
            className={cn(
              "h-6 text-xs border-border/50",
              autoRefreshEnabled 
                ? "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950" 
                : "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950"
            )}
          >
            {autoRefreshEnabled ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {formatLastUpdated(lastUpdated)}
          </Badge>
        </div>
      )}
      
      <Button
        variant={variant}
        size={size}
        onClick={handleRefresh}
        disabled={isLoading}
        className={cn(
          "hover-lift transition-all duration-300",
          isLoading && "animate-pulse",
          className
        )}
      >
        <RefreshCw 
          className={cn(
            "h-4 w-4",
            size === 'sm' ? "mr-1" : "mr-2",
            isLoading && "animate-spin"
          )} 
        />
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
}