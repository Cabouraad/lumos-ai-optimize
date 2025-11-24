-- Add UPDATE policy for org_competitor_exclusions
CREATE POLICY "Users can update exclusions for their org"
ON org_competitor_exclusions
FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);