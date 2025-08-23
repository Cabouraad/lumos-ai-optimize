import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Info } from 'lucide-react';
import { nextThreeAMNY } from '../../lib/time';

interface SchedulerState {
  id: string;
  last_daily_run_key: string | null;
  last_daily_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export function SchedulerStatus() {
  const [schedulerState, setSchedulerState] = useState<SchedulerState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedulerState();
  }, []);

  const loadSchedulerState = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('scheduler-status');

      if (error) {
        console.error('Failed to load scheduler state:', error);
        return;
      }

      setSchedulerState(data);
    } catch (err) {
      console.error('Error loading scheduler state:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNextRunTime = () => {
    const nextRun = nextThreeAMNY();
    return nextRun.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-primary/10 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Loading scheduler status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-primary/10 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                <span>Daily runs at 3:00 AM ET</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Last run: {getRelativeTime(schedulerState?.last_daily_run_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>Next: {getNextRunTime()}</span>
                </div>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
            Automated
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}