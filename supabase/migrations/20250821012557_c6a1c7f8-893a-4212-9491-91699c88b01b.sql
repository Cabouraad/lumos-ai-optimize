-- Enable Row Level Security on the vulnerable views
ALTER TABLE v_competitor_share_7d ENABLE ROW LEVEL SECURITY;
ALTER TABLE v_prompt_visibility_7d ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for v_competitor_share_7d - restrict to org members
CREATE POLICY "Competitor share data access by org membership" 
ON v_competitor_share_7d 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = v_competitor_share_7d.org_id
  )
);

-- Add RLS policy for v_prompt_visibility_7d - restrict to org members  
CREATE POLICY "Prompt visibility data access by org membership"
ON v_prompt_visibility_7d
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = v_prompt_visibility_7d.org_id
  )
);

-- Grant necessary permissions to authenticated users
GRANT SELECT ON v_competitor_share_7d TO authenticated;
GRANT SELECT ON v_prompt_visibility_7d TO authenticated;