-- Add competitors field to organizations table
ALTER TABLE organizations ADD COLUMN competitors text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN organizations.competitors IS 'List of competitor names defined by the organization for filtering prompt results';