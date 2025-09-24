import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock
} from 'lucide-react';
import { useJobCompletion } from '@/features/optimizations/hooks';
import { useQueryClient } from '@tanstack/react-query';

export function JobStatusBanner() {
  const queryClient = useQueryClient();
  
  // Get the latest job ID from query cache
  const latestJobId = queryClient.getQueryData(['latest-job-id']) as string | null;
  
  const job = useJobCompletion(latestJobId);
  
  if (!job || job.status === 'done') {
    return null; // Don't show banner when no job or job is complete
  }

  const statusConfig = {
    queued: {
      icon: Clock,
      label: 'Queued',
      color: 'bg-blue-500/10 text-blue-700 border-blue-200',
      progress: 10
    },
    running: {
      icon: Loader2,
      label: 'Generating',
      color: 'bg-orange-500/10 text-orange-700 border-orange-200',
      progress: 60
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      color: 'bg-red-500/10 text-red-700 border-red-200',
      progress: 100
    }
  };

  const config = statusConfig[job.status as keyof typeof statusConfig];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Card className="border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">
                Optimization Generation
              </span>
              <Badge variant="outline" className={`text-xs ${config.color}`}>
                {config.label}
              </Badge>
            </div>
            
            <Progress value={config.progress} className="h-2" />
            
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {job.status === 'queued' && 'Waiting in queue...'}
                {job.status === 'running' && 'Analyzing prompts and generating content...'}
                {job.status === 'error' && `Error: ${job.error_text || 'Unknown error'}`}
              </span>
              <span>
                Started {new Date(job.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}