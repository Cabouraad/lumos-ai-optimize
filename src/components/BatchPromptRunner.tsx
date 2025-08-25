import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Play, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOrgId } from '@/lib/auth';

interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  progress_percent: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
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

  // Poll for job updates
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
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
          
          if ((data as any).status === 'completed' || (data as any).status === 'failed') {
            clearInterval(pollInterval);
            toast.success(
              (data as any).status === 'completed' 
                ? `Batch completed! ${(data as any).completed_tasks}/${(data as any).total_tasks} tasks successful`
                : `Batch failed after ${(data as any).completed_tasks} tasks`
            );
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
          toast.success('Batch processing started successfully!');
        }
      }
      
    } catch (error: any) {
      console.error('💥 Batch processing error:', error);
      toast.error(`Batch processing error: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Robust Batch Processor
          </CardTitle>
          <Button
            onClick={startBatchProcessing}
            disabled={isStarting || (currentJob && currentJob.status === 'processing')}
            className="flex items-center gap-2"
          >
            {isStarting ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : currentJob && currentJob.status === 'processing' ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Batch Processing
              </>
            )}
          </Button>
        </div>
        
        {currentJob && currentJob.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing batch job...</span>
              <span>{currentJob.completed_tasks + currentJob.failed_tasks}/{currentJob.total_tasks}</span>
            </div>
            <Progress value={currentJob.progress_percent} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {currentJob.metadata?.prompt_count} prompts × {currentJob.metadata?.provider_count} providers
              </span>
              <span>{formatDuration(currentJob.started_at)}</span>
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
                  <div className="font-medium">{currentJob.progress_percent.toFixed(1)}%</div>
                </div>
              </div>

              {currentJob.metadata && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Providers: {currentJob.metadata.provider_names?.join(', ')}
                  </div>
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
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusBadgeVariant(job.status)}>
                      {job.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDuration(job.started_at, job.completed_at)}
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