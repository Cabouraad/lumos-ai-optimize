import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  PlayCircle,
  Settings,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { supabase } from '@/integrations/supabase/client';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface SchedulerState {
  last_daily_run_key?: string;
  last_daily_run_at?: string;
}

interface CleanupStatus {
  current: {
    total_jobs: number;
    failed_jobs: number;
    cancelled_jobs: number;
    old_failed_jobs: number;
  };
  archived: {
    archived_jobs: number;
    archived_tasks: number;
  };
  cleanup_recommended: boolean;
}

export function BatchProcessorAdmin() {
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState<Record<string, CircuitBreakerState>>({});
  const [schedulerState, setSchedulerState] = useState<SchedulerState | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null);
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [isForcingBatch, setIsForcingBatch] = useState(false);
  const [isCheckingScheduler, setIsCheckingScheduler] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [executionWindowInfo, setExecutionWindowInfo] = useState<{
    currentTime: string;
    inWindow: boolean;
    nextWindow: string;
  } | null>(null);

  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    // Get circuit breaker status
    const cbStatus = EnhancedEdgeFunctionClient.getCircuitBreakerStatus();
    setCircuitBreakerStatus(cbStatus);

    // Get scheduler state
    try {
      const { data } = await supabase
        .from('scheduler_state')
        .select('last_daily_run_key, last_daily_run_at')
        .eq('id', 'global')
        .single();
      
      setSchedulerState(data);
    } catch (error) {
      console.error('Failed to load scheduler state:', error);
    }

    // Get cleanup status
    try {
      const { data } = await supabase.rpc('get_batch_cleanup_status');
      setCleanupStatus(data as unknown as CleanupStatus);
    } catch (error) {
      console.error('Failed to load cleanup status:', error);
    }

    // Calculate execution window info
    updateExecutionWindowInfo();
  };

  const updateExecutionWindowInfo = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const nyHour = parseInt(parts.find(part => part.type === 'hour')?.value || '0');
    const inWindow = nyHour >= 3 && nyHour < 6;

    // Calculate next window
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next3AM = new Date(tomorrow);
    next3AM.setHours(3, 0, 0, 0);

    setExecutionWindowInfo({
      currentTime: formatter.format(now) + ' ET',
      inWindow,
      nextWindow: inWindow ? 'Currently in window' : formatter.format(next3AM) + ' ET'
    });
  };

  const resetCircuitBreaker = async (functionName: string) => {
    setIsResetting(functionName);
    try {
      EnhancedEdgeFunctionClient.resetCircuitBreaker(functionName);
      toast.success(`Circuit breaker reset for ${functionName}`);
      loadSystemStatus();
    } catch (error: any) {
      toast.error(`Failed to reset circuit breaker: ${error.message}`);
    } finally {
      setIsResetting(null);
    }
  };

  const forceBatchRun = async () => {
    setIsForcingBatch(true);
    try {
      const { data, error } = await EnhancedEdgeFunctionClient.invoke('daily-batch-trigger', {
        body: { force: true },
        headers: { 'x-manual-call': 'true' }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success(`Batch run forced successfully! Processed ${data.successfulJobs}/${data.totalOrgs} organizations`);
      } else {
        toast.warning(`Batch run completed with issues: ${data?.message || 'Unknown status'}`);
      }
      
      loadSystemStatus();
    } catch (error: any) {
      toast.error(`Failed to force batch run: ${error.message}`);
    } finally {
      setIsForcingBatch(false);
    }
  };

  const checkSchedulerHealth = async () => {
    setIsCheckingScheduler(true);
    try {
      // Call scheduler diagnostics
      const { data, error } = await EnhancedEdgeFunctionClient.invoke('scheduler-diagnostics', {
        body: {},
        headers: { 'x-manual-call': 'true' }
      });

      if (error) {
        throw error;
      }

      toast.success('Scheduler health check completed - see logs for details');
      console.log('Scheduler diagnostics:', data);
    } catch (error: any) {
      toast.error(`Scheduler health check failed: ${error.message}`);
    } finally {
      setIsCheckingScheduler(false);
    }
  };

  const runCleanup = async (dryRun: boolean = false) => {
    setIsRunningCleanup(true);
    try {
      const { data, error } = await supabase.rpc('clean_old_batch_jobs', {
        days_old: 7,
        dry_run: dryRun
      });

      if (error) {
        throw error;
      }

      const cleanupResult = data as any;
      if (dryRun) {
        toast.info(`Cleanup preview: Would archive ${cleanupResult.jobs_to_archive} jobs and ${cleanupResult.tasks_to_archive} tasks`);
      } else {
        toast.success(`Cleanup completed: Archived ${cleanupResult.jobs_archived} jobs and ${cleanupResult.tasks_archived} tasks`);
        loadSystemStatus(); // Refresh status after cleanup
      }
      
      console.log('Cleanup result:', data);
    } catch (error: any) {
      toast.error(`Cleanup failed: ${error.message}`);
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const getCircuitBreakerStatusBadge = (state: CircuitBreakerState) => {
    switch (state.state) {
      case 'CLOSED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'OPEN':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Circuit Open</Badge>;
      case 'HALF_OPEN':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Testing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Batch Processor Admin</h2>
          <p className="text-muted-foreground">Monitor and manage batch processing system</p>
        </div>
        <Button onClick={loadSystemStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Execution Window Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Execution Window Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {executionWindowInfo && (
            <>
              <div className="flex items-center justify-between">
                <span>Current Time (ET):</span>
                <Badge variant="outline">{executionWindowInfo.currentTime}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Execution Window (3-6 AM ET):</span>
                {executionWindowInfo.inWindow ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Currently Open
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    Closed
                  </Badge>
                )}
              </div>
              {!executionWindowInfo.inWindow && (
                <div className="flex items-center justify-between">
                  <span>Next Window:</span>
                  <Badge variant="outline">{executionWindowInfo.nextWindow}</Badge>
                </div>
              )}
            </>
          )}
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Batch processing is automatically scheduled to run daily between 3-6 AM ET. 
              Use "Force Batch Run" below to bypass the execution window for testing or urgent processing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Circuit Breaker Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(circuitBreakerStatus).length === 0 ? (
            <p className="text-muted-foreground">All systems healthy - no circuit breakers active</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(circuitBreakerStatus).map(([functionName, state]) => (
                <div key={functionName} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{functionName}</div>
                    <div className="text-sm text-muted-foreground">
                      {state.failures} failures • Last failure: {formatTimeAgo(state.lastFailureTime)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getCircuitBreakerStatusBadge(state)}
                    {state.state !== 'CLOSED' && (
                      <Button
                        onClick={() => resetCircuitBreaker(functionName)}
                        disabled={isResetting === functionName}
                        variant="outline"
                        size="sm"
                      >
                        {isResetting === functionName ? (
                          <>Resetting...</>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reset
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Scheduler Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedulerState && (
            <>
              <div className="flex items-center justify-between">
                <span>Last Daily Run:</span>
                <Badge variant="outline">
                  {schedulerState.last_daily_run_key || 'Never'}
                </Badge>
              </div>
              {schedulerState.last_daily_run_at && (
                <div className="flex items-center justify-between">
                  <span>Last Run Time:</span>
                  <Badge variant="outline">
                    {new Date(schedulerState.last_daily_run_at).toLocaleString()}
                  </Badge>
                </div>
              )}
            </>
          )}
          
          <Separator />
          
          <div className="flex space-x-2">
            <Button
              onClick={checkSchedulerHealth}
              disabled={isCheckingScheduler}
              variant="outline"
              size="sm"
            >
              {isCheckingScheduler ? (
                <>Checking...</>
              ) : (
                <>
                  <Settings className="w-3 h-3 mr-1" />
                  Health Check
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Cleanup Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Database Cleanup Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cleanupStatus ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Current Jobs</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Total:</span>
                    <Badge variant="outline">{cleanupStatus.current.total_jobs}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Failed:</span>
                    <Badge variant="outline">{cleanupStatus.current.failed_jobs}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Old Failed (&gt;7d):</span>
                    <Badge className={cleanupStatus.current.old_failed_jobs > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>
                      {cleanupStatus.current.old_failed_jobs}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Archived</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Jobs:</span>
                    <Badge variant="outline">{cleanupStatus.archived.archived_jobs}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Tasks:</span>
                    <Badge variant="outline">{cleanupStatus.archived.archived_tasks}</Badge>
                  </div>
                </div>
              </div>

              {cleanupStatus.cleanup_recommended && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    There are {cleanupStatus.current.old_failed_jobs} old failed jobs that can be cleaned up to improve database performance.
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex space-x-2">
                <Button
                  onClick={() => runCleanup(true)}
                  disabled={isRunningCleanup}
                  variant="outline"
                  size="sm"
                >
                  {isRunningCleanup ? (
                    <>Checking...</>
                  ) : (
                    <>Preview Cleanup</>
                  )}
                </Button>
                <Button
                  onClick={() => runCleanup(false)}
                  disabled={isRunningCleanup || !cleanupStatus.cleanup_recommended}
                  variant="outline"
                  size="sm"
                >
                  {isRunningCleanup ? (
                    <>Running...</>
                  ) : (
                    <>Run Cleanup</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Loading cleanup status...</p>
          )}
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-amber-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Emergency Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              These controls bypass normal scheduling and should only be used for testing or urgent processing needs.
            </AlertDescription>
          </Alert>
          
          <Button
            onClick={forceBatchRun}
            disabled={isForcingBatch}
            variant="outline"
            className="w-full"
          >
            {isForcingBatch ? (
              <>Processing...</>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Force Batch Run (Bypass Execution Window)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}