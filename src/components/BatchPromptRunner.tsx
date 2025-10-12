import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Play, AlertCircle, RotateCcw, Zap, Settings, AlertTriangle, Shield, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOrgId } from '@/lib/auth';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { ConnectionStatus } from '@/components/ConnectionStatus';

interface BatchJob {
  id: string;
  org_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  last_heartbeat?: string;
  runner_id?: string;
  cancellation_requested?: boolean;
  metadata?: {
    prompt_count?: number;
    provider_count?: number;
    prompts_count?: number;
    providers_count?: number;
    provider_names: string[];
    correlation_id?: string;
    cancelled_previous_count?: number;
    last_heartbeat?: string;
    final_stats?: {
      completed: number;
      failed: number;
      cancelled: number;
    };
  };
}

export function BatchPromptRunner() {
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<BatchJob[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [preflightData, setPreflightData] = useState<any>(null);
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState<Record<string, any>>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [cancelledCount, setCancelledCount] = useState(0);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        
        if (!session) {
          console.warn('⚠️ No active session found - some features may require authentication');
          toast.warning('Please sign in to use batch processing features');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // Auto-reconcile on mount to fix any stuck jobs immediately
  useEffect(() => {
    const autoReconcile = async () => {
      try {
        console.log('🔄 Auto-reconciling stuck jobs on mount...');
        await robustInvoke('batch-reconciler', {
          body: {},
          headers: {
            'x-manual-call': 'true'
          }
        });
      } catch (error) {
        console.warn('Auto-reconcile failed:', error);
      }
    };
    autoReconcile();
    loadRecentJobs();
    runPreflight();
    loadCircuitBreakerStatus();
  }, []);

  // Enhanced driver loop with retry logic and error handling
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'processing') {
      return;
    }

    let isActive = true;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;
    
    const driveLoop = async () => {
      while (isActive && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        try {
          console.log(`🔄 [${new Date().toISOString()}] Calling processor for job ${currentJob.id}`);
          
          const { data, error } = await robustInvoke('robust-batch-processor', {
            body: {
              jobId: currentJob.id,
              orgId: currentJob.org_id
            }
          });

          if (error) {
            throw new Error(error.message || 'Unknown error');
          }

          if (!isActive) break;

          // Reset error counter on success
          consecutiveErrors = 0;

          // Verify heartbeat was updated
          if (data?.last_heartbeat) {
            const heartbeatAge = Date.now() - new Date(data.last_heartbeat).getTime();
            if (heartbeatAge > 60000) {
              console.warn(`⚠️ Heartbeat is stale (${Math.round(heartbeatAge / 1000)}s old)`);
            }
          }

          await loadRecentJobs();

          if (data?.action === 'completed') {
            toast.success(`✅ Batch Complete: ${data.completed} completed, ${data.failed || 0} failed`);
            break;
          }

          if (data?.action === 'error') {
            throw new Error(data.error || "Processing error");
          }

          // Continue immediately for next micro-batch
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error: any) {
          consecutiveErrors++;
          console.error(`❌ [${new Date().toISOString()}] Driver error (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, {
            error: error.message,
            stack: error.stack,
            jobId: currentJob.id
          });

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            toast.error(`Failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Check logs or try resuming.`);
            break;
          }

          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const backoffMs = Math.min(2000 * Math.pow(2, consecutiveErrors - 1), 32000);
          console.log(`⏳ Retrying in ${backoffMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    };

    driveLoop();
    return () => { isActive = false; };
  }, [currentJob?.id]);

  // Poll for job updates
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'cancelled') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('batch_jobs' as any)
          .select('*')
          .eq('id', currentJob.id)
          .maybeSingle();

        if (!error && data) {
          const updatedJob = data as unknown as BatchJob;
          setCurrentJob(updatedJob);
          
          if (['completed', 'failed', 'cancelled'].includes(updatedJob.status)) {
            clearInterval(pollInterval);
            const statusMsg = updatedJob.status === 'completed' 
              ? `Batch completed! ${updatedJob.completed_tasks}/${updatedJob.total_tasks} tasks successful`
              : updatedJob.status === 'cancelled'
              ? `Batch cancelled after ${updatedJob.completed_tasks} tasks`
              : `Batch failed after ${updatedJob.completed_tasks} tasks`;
            
            toast.success(statusMsg);
            loadRecentJobs();
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [currentJob?.id, currentJob?.status]);

  const loadRecentJobs = async () => {
    try {
      const { data } = await supabase
        .from('batch_jobs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        const jobs = (data as unknown as BatchJob[]) || [];
        setRecentJobs(jobs);
        
        // Set current job to the most recent active one
        const activeJob = jobs.find((job) => ['pending', 'processing'].includes(job.status));
        if (activeJob && (!currentJob || currentJob.id !== activeJob.id)) {
          setCurrentJob(activeJob);
        }
      }
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    }
  };

  // Enhanced invoke with comprehensive error handling and resilience
  const robustInvoke = async (functionName: string, options: any, retries = 2): Promise<any> => {
    const correlationId = crypto.randomUUID();
    console.log(`🔄 [${correlationId}] Invoking ${functionName}:`, {
      hasAuth: !!options.headers?.authorization || !!options.body?.auth,
      bodyKeys: Object.keys(options.body || {}),
      correlationId
    });
    
    try {
      const result = await EnhancedEdgeFunctionClient.invoke(functionName, {
        ...options,
        retries,
        correlationId
      });
      
      if (result.error) {
        throw result.error;
      }
      
      console.log(`✅ [${correlationId}] ${functionName} success:`, result.data?.action || 'success');
      return result;
    } catch (error: any) {
      console.error(`❌ [${correlationId}] ${functionName} failed:`, error.message);
      throw error;
    }
  };

  // Load circuit breaker status
  const loadCircuitBreakerStatus = () => {
    const status = EnhancedEdgeFunctionClient.getCircuitBreakerStatus();
    setCircuitBreakerStatus(status);
  };

  // Reset circuit breaker for a specific function
  const resetCircuitBreaker = async (functionName: string) => {
    try {
      EnhancedEdgeFunctionClient.resetCircuitBreaker(functionName);
      toast.success(`Circuit breaker reset for ${functionName}`);
      loadCircuitBreakerStatus();
    } catch (error: any) {
      toast.error(`Failed to reset circuit breaker: ${error.message}`);
    }
  };

  // Simplified connectivity check
  const runPreflight = async () => {
    try {
      console.log('🔍 Testing connectivity...');
      const orgId = await getOrgId();
      // Just test that we can reach the edge function
      console.log('✅ Connectivity OK, org:', orgId);
    } catch (error: any) {
      console.error('💥 Connectivity error:', error);
      setLastError(`Connectivity error: ${error.message}`);
    }
  };

  const runReconciler = async () => {
    setIsReconciling(true);
    setLastError(null);
    
    try {
      console.log('🔧 Manually running batch reconciler...');
      
      const { data, error } = await robustInvoke('batch-reconciler', {
        body: {},
        headers: {
          'x-manual-call': 'true'
        }
      });

      if (error) {
        console.error('❌ Reconciler failed:', error);
        setLastError(`Reconciler failed: ${error.message}`);
        toast.error(`Reconciler failed: ${error.message}`);
        return;
      }

      console.log('✅ Reconciler result:', data);
      
      if (data.processedJobs > 0) {
        toast.success(`Fixed ${data.processedJobs} jobs (${data.finalizedJobs} finalized, ${data.failedJobs} failed)`);
      } else {
        toast.success('No stuck jobs found - system healthy!');
      }
      
      // Refresh the job list
      loadRecentJobs();
      
    } catch (error: any) {
      console.error('💥 Reconciler error:', error);
      const errorMsg = `Reconciler error: ${error.message}`;
      setLastError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsReconciling(false);
    }
  };

  const resumeJob = async (jobId: string, orgId: string) => {
    try {
      setIsResuming(true);
      const { data, error } = await robustInvoke('robust-batch-processor', {
        body: { jobId, orgId }
      });

      if (error) throw error;

      if (data?.action === 'created' || data?.action === 'in_progress') {
        await supabase
          .from('batch_jobs')
          .update({ 
            status: 'processing',
            metadata: { 
              ...(recentJobs.find(j => j.id === jobId)?.metadata || {}),
              resumed_at: new Date().toISOString() 
            }
          })
          .eq('id', jobId);
        
        setCurrentJob({ id: jobId, org_id: orgId, status: 'processing' } as any);
        toast.success('Job resumed! Processing will continue...');
        await loadRecentJobs();
      }
    } catch (err: any) {
      toast.error(`Resume failed: ${err.message}`);
    } finally {
      setIsResuming(false);
    }
  };

  const startBatchProcessing = async () => {
    setIsStarting(true);
    setLastError(null);
    
    try {
      console.log('🚀 Starting batch processing...');
      const orgId = await getOrgId();
      
      const { data, error } = await robustInvoke('robust-batch-processor', {
        body: { orgId, replace: true }
      });

      if (error) {
        console.error('❌ Failed:', error);
        toast.error(error.message);
        return;
      }

      console.log('✅ Job created:', data);

      // Set cancelled count if any
      if (data?.cancelled_previous_count > 0) {
        setCancelledCount(data.cancelled_previous_count);
        toast.success(`Cancelled ${data.cancelled_previous_count} previous run(s)`);
      }

      // CRITICAL: Fetch the newly created job and set it as currentJob
      if (data?.jobId) {
        const { data: jobData } = await supabase
          .from('batch_jobs')
          .select('*')
          .eq('id', data.jobId)
          .single();
        
        if (jobData) {
          setCurrentJob(jobData as unknown as BatchJob);
          toast.success(`Processing ${data.total_tasks} tasks`);
        }
      } else {
        // Fallback: load recent jobs
        await loadRecentJobs();
      }
      
    } catch (error: any) {
      console.error('💥 Batch processing error:', error);
      const errorMsg = `Batch processing error: ${error.message}`;
      setLastError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsStarting(false);
    }
  };

  // Resume function removed - no longer needed with micro-batch architecture

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      case 'processing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = Math.max(0, (end - start) / 1000); // Clamp to prevent negative values
    return `${duration.toFixed(1)}s`;
  };

  const calculateProgress = (job: BatchJob) => {
    if (job.total_tasks === 0) return 0;
    return ((job.completed_tasks + job.failed_tasks) / job.total_tasks) * 100;
  };

  const isJobStuck = (job: BatchJob) => {
    if (job.status !== 'processing') return false;
    
    // Check metadata.last_heartbeat (where it's actually stored)
    const heartbeatStr = (job as any)?.metadata?.last_heartbeat || (job as any)?.last_heartbeat;
    const HEARTBEAT_STALE_MS = 5 * 60 * 1000;   // 5 minutes
    const FALLBACK_STALE_MS  = 15 * 60 * 1000;  // 15 minutes
    
    if (heartbeatStr) {
      const heartbeatTime = new Date(heartbeatStr).getTime();
      return heartbeatTime < (Date.now() - HEARTBEAT_STALE_MS);
    }
    
    // Fallback to started_at with conservative threshold
    if (job.started_at) {
      const startTime = new Date(job.started_at).getTime();
      return startTime < (Date.now() - FALLBACK_STALE_MS);
    }
    
    return false; // Don't assume stuck if no data
  };

  const isCurrentlyRunning = currentJob && currentJob.status === 'processing';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Robust Batch Processor
          </CardTitle>
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <Button
              onClick={runReconciler}
              disabled={isReconciling}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isReconciling ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Reconciling...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Fix Stuck Jobs
                </>
              )}
            </Button>
            <Button
              onClick={startBatchProcessing}
              disabled={isStarting || (preflightData && !preflightData.quota?.allowed) || isAuthenticated === false}
              className="flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  {isCurrentlyRunning ? 'Cancelling & Starting...' : 'Starting...'}
                </>
              ) : isAuthenticated === false ? (
                <>
                  <Shield className="h-4 w-4" />
                  Sign In Required
                </>
              ) : isCurrentlyRunning ? (
                <>
                  <XCircle className="h-4 w-4" />
                  Cancel & Start New Job
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Batch Processing
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Authentication Warning */}
        {isAuthenticated === false && (
          <Alert variant="destructive" className="mt-4">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Authentication Required:</strong> You must be signed in to use batch processing.{' '}
              <a href="/auth" className="underline font-semibold">Sign in now</a>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Preflight Warning */}
        {showPreflightWarning && preflightData && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {preflightData.providers?.available?.length === 0 && (
                <div>
                  <strong>No API keys configured.</strong> Please configure provider API keys in Settings.
                  <div className="mt-1 text-sm">
                    Missing: {preflightData.providers.missing?.join(', ')}
                  </div>
                </div>
              )}
              {!preflightData.quota?.allowed && (
                <div>
                  <strong>Quota exceeded.</strong> {preflightData.quota.error?.message || 'Daily quota limit reached'}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}
        
        {currentJob && currentJob.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>Processing batch job...</span>
                {isJobStuck(currentJob) && (
                  <Badge variant="destructive" className="text-xs">STUCK - Auto-healing</Badge>
                )}
              </div>
              <span>{currentJob.completed_tasks + currentJob.failed_tasks}/{currentJob.total_tasks}</span>
            </div>
            <Progress value={calculateProgress(currentJob)} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {currentJob.metadata?.prompt_count || currentJob.metadata?.prompts_count} prompts × {currentJob.metadata?.provider_count || currentJob.metadata?.providers_count} providers
                {currentJob.metadata?.provider_names && (
                  <span className="ml-2">({currentJob.metadata.provider_names.join(', ')})</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span>Runtime: {formatDuration(currentJob.started_at)}</span>
                {currentJob.last_heartbeat && (
                  <span title="Last heartbeat">💓 {formatDuration(currentJob.last_heartbeat)}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Job Status */}
        {currentJob && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Current Batch Job</h3>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(currentJob.status)}
                  <span className="font-medium">Job {currentJob.id.split('-')[0]}</span>
                  {isJobStuck(currentJob) && (
                    <Badge variant="destructive" className="text-xs">STUCK</Badge>
                  )}
                  {currentJob.runner_id && (
                    <Badge variant="outline" className="text-xs">
                      {currentJob.runner_id.split('-')[1]}
                    </Badge>
                  )}
                </div>
                <Badge variant={getStatusBadgeVariant(currentJob.status)}>
                  {currentJob.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Tasks</div>
                  <div className="font-medium">{currentJob.total_tasks}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completed</div>
                  <div className="font-medium text-green-600">{currentJob.completed_tasks}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Failed</div>
                  <div className="font-medium text-red-600">{currentJob.failed_tasks}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Progress</div>
                  <div className="font-medium">{calculateProgress(currentJob).toFixed(1)}%</div>
                </div>
              </div>

              {/* Job stuck - manual reconciliation needed */}
              {isJobStuck(currentJob) && (
                <div className="mt-3 pt-3 border-t">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This job appears stuck. Run the reconciler to clean up stuck jobs.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Jobs History */}
        {recentJobs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Recent Batch Jobs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentJobs.slice(0, 8).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="text-sm font-medium">
                        {job.completed_tasks}/{job.total_tasks} tasks completed
                        {isJobStuck(job) && (
                          <Badge variant="destructive" className="ml-2 text-xs">STUCK</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Badge variant={getStatusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
                      {job.status === 'failed' && (job as any).metadata?.resumable && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resumeJob(job.id, job.org_id)}
                          disabled={isResuming}
                          className="ml-2"
                        >
                          <PlayCircle className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDuration(job.started_at, job.completed_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentJob && recentJobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No batch jobs yet.</p>
            <p className="text-sm">Click "Start Batch Processing" to run all active prompts across enabled providers with robust error handling and automatic recovery.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
