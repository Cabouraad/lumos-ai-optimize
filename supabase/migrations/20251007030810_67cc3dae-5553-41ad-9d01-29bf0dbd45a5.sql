-- Add RLS policies to allow users to delete their organization's reports

-- Allow users to delete PDF reports from their own organization
CREATE POLICY "org_members_can_delete_reports"
ON public.reports
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.org_id = reports.org_id
  )
);

-- Allow users to delete CSV reports from their own organization
CREATE POLICY "org_members_can_delete_weekly_reports"
ON public.weekly_reports
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.org_id = weekly_reports.org_id
  )
);