import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Play, AlertCircle, RotateCcw, Zap, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOrgId } from '@/lib/auth';

interface BatchJob {
  id: string;
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
    prompts_count?: number;  // Legacy field name support
    providers_count?: number;  // Legacy field name support
    provider_names: string[];
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
  const [isResuming, setIsResuming] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-reconcile on mount to fix any stuck jobs immediately
  useEffect(() => {
    const autoReconcile = async () => {
      try {
        console.log('🔄 Auto-reconciling stuck jobs on mount...');
        await supabase.functions.invoke('batch-reconciler', {
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
  }, []);

  // Poll for job updates with auto-reconciliation for stuck jobs
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
          .single();

        if (!error && data) {
          const updatedJob = data as unknown as BatchJob;
          setCurrentJob(updatedJob);
          
          // Check if job appears stuck (no heartbeat for 3 minutes)
          const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
          const lastHeartbeat = updatedJob.last_heartbeat ? new Date(updatedJob.last_heartbeat).getTime() : 0;
          
          if (updatedJob.status === 'processing' && lastHeartbeat < threeMinutesAgo) {
            console.log('🚨 Job appears stuck, triggering auto-reconciliation...');
            try {
              await supabase.functions.invoke('batch-reconciler', {
                body: {},
                headers: {
                  'x-manual-call': 'true'
                }
              });
              toast.warning('Job appeared stuck - attempted automatic recovery');
            } catch (reconcileError) {
              console.error('Auto-reconcile failed:', reconcileError);
            }
          }
          
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
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [currentJob]);

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

  const runReconciler = async () => {
    setIsReconciling(true);
    setLastError(null);
    
    try {
      console.log('🔧 Manually running batch reconciler...');
      
      const { data, error } = await supabase.functions.invoke('batch-reconciler', {
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
        toast.success(`Reconciler processed ${data.processedJobs} jobs: ${data.finalizedJobs} finalized, ${data.resumedJobs} resumed`);
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

  const startBatchProcessing = async () => {
    setIsStarting(true);
    setLastError(null);
    
    try {
      console.log('🚀 Starting robust batch processing...');
      
      const orgId = await getOrgId();
      
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: { 
          orgId,
          replace: true  // CANCEL EXISTING: Always replace existing jobs when starting new batch
        }
      });

      if (error) {
        console.error('❌ Batch processing failed:', error);
        const errorMsg = `Batch processing failed: ${error.message}`;
        setLastError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      console.log('✅ Batch processing result:', data);
      
      if (!data.success) {
        const errorMsg = data.error || 'Batch processing failed';
        setLastError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      
      // Handle in-progress status (time budget exceeded)
      if (data.action === 'in_progress') {
        toast.success(`Processing started! ${data.processedSoFar} tasks completed so far. Processing continues in background.`);
        loadRecentJobs();
        return;
      }
      
      if (data.batchJobId || data.jobId) {
        const jobIdToUse = data.batchJobId || data.jobId;
        
        // Load the created job immediately
        const { data: jobData } = await supabase
          .from('batch_jobs' as any)
          .select('*')
          .eq('id', jobIdToUse)
          .single();

        if (jobData) {
          setCurrentJob(jobData as unknown as BatchJob);
          if (data.action === 'started') {
            toast.success(`Batch started! Processing ${data.totalTasks || data.totalProcessed} tasks`);
          } else if (data.action === 'resumed') {
            toast.success(`Job resumed! ${data.message || 'Processing continuation'}`);
          } else if (data.action === 'processed') {
            toast.success(`Job processed: ${data.completedTasks} completed, ${data.failedTasks} failed`);
          }
        }
      } else if (data.action === 'finalized') {
        toast.success(`Job already complete: ${data.completedTasks} tasks successful`);
        loadRecentJobs();
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

  const resumeStuckJob = async (jobId: string) => {
    setIsResuming(jobId);
    setLastError(null);
    
    try {
      console.log('🔄 Resuming stuck job:', jobId);
      
      const orgId = await getOrgId();
      
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: { orgId, resumeJobId: jobId }
      });

      if (error) {
        console.error('❌ Resume failed:', error);
        const errorMsg = `Resume failed: ${error.message}`;
        setLastError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      console.log('✅ Resume result:', data);
      
      if (!data.success) {
        const errorMsg = data.error || 'Resume failed';
        setLastError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      
      // Handle in-progress status for resumes too
      if (data.action === 'in_progress') {
        toast.success(`Resume in progress! ${data.processedSoFar} tasks completed so far.`);
        loadRecentJobs();
        return;
      }
      
      if (data.action === 'finalized') {
        toast.success(`Job finalized: ${data.completedTasks}/${data.completedTasks + data.failedTasks} tasks completed`);
      } else if (data.action === 'resumed') {
        toast.success(`Job resumed: processing ${data.totalTasks} tasks`);
      } else {
        toast.success(data.message || 'Job processed successfully');
      }
      
      // Refresh the job list
      loadRecentJobs();
      
    } catch (error: any) {
      console.error('💥 Resume error:', error);
      const errorMsg = `Resume error: ${error.message}`;
      setLastError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsResuming(null);
    }
  };

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
    return `${((end - start) / 1000).toFixed(1)}s`;
  };

  const calculateProgress = (job: BatchJob) => {
    if (job.total_tasks === 0) return 0;
    return ((job.completed_tasks + job.failed_tasks) / job.total_tasks) * 100;
  };

  const isJobStuck = (job: BatchJob) => {
    if (job.status !== 'processing') return false;
    
    // Check if heartbeat is older than 3 minutes
    if (job.last_heartbeat) {
      const heartbeatTime = new Date(job.last_heartbeat).getTime();
      const threeMinutesAgo = Date.now() - (3 * 60 * 1000);
      return heartbeatTime < threeMinutesAgo;
    }
    
    // If no heartbeat and started more than 3 minutes ago
    if (job.started_at) {
      const startTime = new Date(job.started_at).getTime();
      const threeMinutesAgo = Date.now() - (3 * 60 * 1000);
      return startTime < threeMinutesAgo;
    }
    
    return true; // No heartbeat or start time means it's likely stuck
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
              disabled={isStarting}
              className="flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : isCurrentlyRunning ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Replace Running Job
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
        
        {/* Error Alert */}
        {lastError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div>
              <strong>Error:</strong> {lastError}
              {lastError.includes('No provider API keys') && (
                <div className="mt-1 text-xs">
                  Go to <Settings className="h-3 w-3 inline mx-1" /> Settings to configure your provider API keys.
                </div>
              )}
            </div>
          </div>
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

              {/* Resume button for stuck jobs */}
              {isJobStuck(currentJob) && (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    onClick={() => resumeStuckJob(currentJob.id)}
                    disabled={isResuming === currentJob.id}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isResuming === currentJob.id ? (
                      <>
                        <Clock className="h-4 w-4 animate-spin mr-2" />
                        Resuming...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Resume Stuck Job
                      </>
                    )}
                  </Button>
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
                    {isJobStuck(job) && job.status === 'processing' && (
                      <Button
                        onClick={() => resumeStuckJob(job.id)}
                        disabled={isResuming === job.id}
                        variant="outline"
                        size="sm"
                      >
                        {isResuming === job.id ? (
                          <Clock className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    <div className="text-right">
                      <Badge variant={getStatusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
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
