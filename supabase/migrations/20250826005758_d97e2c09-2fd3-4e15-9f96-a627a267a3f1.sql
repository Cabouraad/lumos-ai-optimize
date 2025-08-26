-- Create batch_jobs table for tracking batch processing jobs
CREATE TABLE public.batch_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create batch_tasks table for tracking individual tasks within a batch job
CREATE TABLE public.batch_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_job_id UUID NOT NULL REFERENCES public.batch_jobs(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for batch_jobs (service role only for operations)
CREATE POLICY "batch_jobs_service_all" 
ON public.batch_jobs 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "batch_jobs_user_read" 
ON public.batch_jobs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = batch_jobs.org_id
  )
);

-- Create policies for batch_tasks (service role only for operations)
CREATE POLICY "batch_tasks_service_all" 
ON public.batch_tasks 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "batch_tasks_user_read" 
ON public.batch_tasks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    JOIN batch_jobs bj ON bj.org_id = u.org_id
    WHERE u.id = auth.uid() 
    AND bj.id = batch_tasks.batch_job_id
  )
);

-- Create indexes for performance
CREATE INDEX idx_batch_jobs_org_id ON public.batch_jobs(org_id);
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX idx_batch_tasks_batch_job_id ON public.batch_tasks(batch_job_id);
CREATE INDEX idx_batch_tasks_status ON public.batch_tasks(status);
CREATE INDEX idx_batch_tasks_prompt_id ON public.batch_tasks(prompt_id);