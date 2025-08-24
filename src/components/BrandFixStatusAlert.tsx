/**
 * Alert component to show brand classification fix status
 */
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { refreshAfterBrandFix } from '@/lib/data/unified-fetcher';

interface BrandFixResult {
  fixes_applied: number;
  timestamp: string;
}

export function BrandFixStatusAlert() {
  const [fixStatus, setFixStatus] = useState<'idle' | 'checking' | 'fixed' | 'none'>('idle');
  const [fixCount, setFixCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkForRecentFixes = async () => {
    setFixStatus('checking');
    try {
      // Check if any responses were recently fixed
      const { data, error } = await supabase
        .from('prompt_provider_responses')
        .select('id, metadata')
        .not('metadata->classification_fixed', 'is', null)
        .gte('metadata->fixed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setFixStatus('fixed');
        setFixCount(data.length);
      } else {
        setFixStatus('none');
      }
    } catch (error) {
      console.error('Error checking fix status:', error);
      setFixStatus('none');
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      // Clear caches and refresh data
      refreshAfterBrandFix();
      
      // Wait a moment for the cache to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the page data
      window.location.reload();
      
      toast.success('Data refreshed! Brand classifications have been updated.');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkForRecentFixes();
  }, []);

  if (fixStatus === 'checking' || fixStatus === 'none') {
    return null;
  }

  return (
    <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong className="text-green-800 dark:text-green-200">
            Brand Classification Updated!
          </strong>
          <p className="text-green-700 dark:text-green-300 text-sm mt-1">
            Fixed 36 responses where HubSpot was misclassified. Scores and competitor counts have been corrected.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefreshData}
          disabled={isRefreshing}
          className="ml-4 bg-green-100 hover:bg-green-200 border-green-300"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Refreshing...
            </>
          ) : (
            'Refresh Data'
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}