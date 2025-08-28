
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Play, AlertCircle, RotateCcw, Zap } from 'lucide-react';
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
    prompt_count: number;
    provider_count: number;
    provider_names: string[];
  };
}

export function BatchPromptRunner() {
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<BatchJob[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isResuming, setIsResuming] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Auto-reconcile on mount to fix any stuck jobs immediately
  useEffect(() => {
    const autoReconcile = async () => {
      try {
        console.log('🔄 Auto-reconciling stuck jobs on mount...');
        await supabase.functions.invoke('batch-reconciler');
      } catch (error) {
        console.warn('Auto-reconcile failed:', error);
      }
    };
    autoReconcile();
  }, []);

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
          .single();

        if (!error && data) {
          setCurrentJob(data as unknown as BatchJob);
          
          if ((data as any).status === 'completed' || (data as any).status === 'failed' || (data as any).status === 'cancelled') {
            clearInterval(pollInterval);
            const statusMsg = (data as any).status === 'completed' 
              ? `Batch completed! ${(data as any).completed_tasks}/${(data as any).total_tasks} tasks successful`
              : (data as any).status === 'cancelled'
              ? `Batch cancelled after ${(data as any).completed_tasks} tasks`
              : `Batch failed after ${(data as any).completed_tasks} tasks`;
            
            toast.success(statusMsg);
            loadRecentJobs();
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  // Load recent jobs on mount
  useEffect(() => {
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    try {
      const { data } = await supabase
        .from('batch_jobs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setRecentJobs(data as unknown as BatchJob[]);
      }
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    }
  };

  const runReconciler = async () => {
    setIsReconciling(true);
    
    try {
      console.log('🔧 Manually running batch reconciler...');
      
      const { data, error } = await supabase.functions.invoke('batch-reconciler');

      if (error) {
        console.error('❌ Reconciler failed:', error);
        toast.error(`Reconciler failed: ${error.message}`);
        return;
      }

      console.log('✅ Reconciler result:', data);
      
      if (data.processedJobs > 0) {
        toast.success(`Reconciler processed ${data.processedJobs} jobs: ${data.finalizedJobs} finalized, ${data.resumedJobs} resumed`);
      } else {
        toast.success('No stuck jobs found - all clean!');
      }
      
      // Refresh the job list
      loadRecentJobs();
      
    } catch (error: any) {
      console.error('💥 Reconciler error:', error);
      toast.error(`Reconciler error: ${error.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const startBatchProcessing = async () => {
    setIsStarting(true);
    
    try {
      console.log('🚀 Starting robust batch processing...');
      
      const orgId = await getOrgId();
      
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: { orgId }
      });

      if (error) {
        console.error('❌ Batch processing failed:', error);
        toast.error(`Batch processing failed: ${error.message}`);
        return;
      }

      console.log('✅ Batch processing started:', data);
      
      if (data.batchJobId) {
        // Load the created job
        const { data: jobData } = await supabase
          .from('batch_jobs' as any)
          .select('*')
          .eq('id', data.batchJobId)
          .single();

        if (jobData) {
          setCurrentJob(jobData as unknown as BatchJob);
          toast.success('Batch processing started successfully! Previous jobs cancelled.');
        }
      }
      
    } catch (error: any) {
      console.error('💥 Batch processing error:', error);
      toast.error(`Batch processing error: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const resumeStuckJob = async (jobId: string) => {
    setIsResuming(jobId);
    
    try {
      console.log('🔄 Resuming stuck job:', jobId);
      
      const orgId = await getOrgId();
      
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: { orgId, resumeJobId: jobId }
      });

      if (error) {
        console.error('❌ Resume failed:', error);
        toast.error(`Resume failed: ${error.message}`);
        return;
      }

      console.log('✅ Resume result:', data);
      
      if (data.action === 'finalized') {
        toast.success(`Job finalized: ${data.completedTasks}/${data.completedTasks + data.failedTasks} tasks completed`);
      } else if (data.action === 'resumed') {
        toast.success(`Job resumed: ${data.pendingTasks} tasks will be processed`);
      } else {
        toast.success(data.message || 'Job processed successfully');
      }
      
      // Refresh the job list
      loadRecentJobs();
      
      // If this was the current job, update it
      if (currentJob && currentJob.id === jobId) {
        const { data: jobData } = await supabase
          .from('batch_jobs' as any)
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobData) {
          setCurrentJob(jobData as unknown as BatchJob);
        }
      }
      
    } catch (error: any) {
      console.error('💥 Resume error:', error);
      toast.error(`Resume error: ${error.message}`);
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
    
    // Check if heartbeat is older than 2 minutes
    if (job.last_heartbeat) {
      const heartbeatTime = new Date(job.last_heartbeat).getTime();
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
      return heartbeatTime < twoMinutesAgo;
    }
    
    // If no heartbeat and started more than 2 minutes ago
    if (job.started_at) {
      const startTime = new Date(job.started_at).getTime();
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
      return startTime < twoMinutesAgo;
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
        
        {currentJob && currentJob.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>Processing batch job...</span>
                {isJobStuck(currentJob) && (
                  <Badge variant="destructive" className="text-xs">STUCK</Badge>
                )}
              </div>
              <span>{currentJob.completed_tasks + currentJob.failed_tasks}/{currentJob.total_tasks}</span>
            </div>
            <Progress value={calculateProgress(currentJob)} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {currentJob.metadata?.prompt_count} prompts × {currentJob.metadata?.provider_count} providers
              </span>
              <div className="flex items-center gap-2">
                <span>{formatDuration(currentJob.started_at)}</span>
                {currentJob.last_heartbeat && (
                  <span>💓 {formatDuration(currentJob.last_heartbeat)}</span>
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

              {currentJob.metadata && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Providers: {currentJob.metadata.provider_names?.join(', ')}
                  </div>
                </div>
              )}

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
            <div className="space-y-2">
              {recentJobs.map((job) => (
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
                    {isJobStuck(job) && (
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
            <p>No batch jobs yet. Click "Start Batch Processing" to run all active prompts across enabled providers with robust error handling and progress tracking.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
