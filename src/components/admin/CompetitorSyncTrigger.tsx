import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Play } from 'lucide-react';

export function CompetitorSyncTrigger() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const triggerSync = async () => {
    setIsTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-competitor-detection');
      
      if (error) {
        throw error;
      }

      setLastResult(data);
      toast.success('Competitor sync completed successfully', {
        description: `Processed ${data?.orgsProcessed || 0} organizations`
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync competitors', {
        description: error.message
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Competitor Sync Management
        </CardTitle>
        <CardDescription>
          Manually trigger the organization-specific competitor detection and brand catalog sync
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={triggerSync} 
            disabled={isTriggering}
            className="flex items-center gap-2"
          >
            {isTriggering ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isTriggering ? 'Syncing...' : 'Trigger Sync'}
          </Button>
        </div>

        {lastResult && (
          <div className="space-y-3">
            <h4 className="font-medium">Last Sync Results:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Organizations</span>
                <Badge variant="outline">{lastResult.orgsProcessed || 0}</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Added</span>
                <Badge variant="default">{lastResult.competitorsAdded || 0}</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Updated</span>
                <Badge variant="secondary">{lastResult.competitorsUpdated || 0}</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Removed</span>
                <Badge variant="destructive">{lastResult.competitorsRemoved || 0}</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Analyzed {lastResult.responsesAnalyzed || 0} responses • {lastResult.timestamp}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}