-- Fix security issues for the new archive tables
-- Add RLS policies for batch_jobs_archive and batch_tasks_archive

-- Enable RLS on archive tables
ALTER TABLE batch_jobs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_tasks_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies for batch_jobs_archive
CREATE POLICY "batch_jobs_archive_service_all" 
ON batch_jobs_archive
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "batch_jobs_archive_admin_read" 
ON batch_jobs_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (u.role = 'owner' OR u.email LIKE '%@test.app')
  )
);

-- RLS policies for batch_tasks_archive  
CREATE POLICY "batch_tasks_archive_service_all" 
ON batch_tasks_archive
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "batch_tasks_archive_admin_read" 
ON batch_tasks_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (u.role = 'owner' OR u.email LIKE '%@test.app')
  )
);