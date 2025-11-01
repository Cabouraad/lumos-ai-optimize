-- Add metadata column to domain_invitations table to store invitation details like role
ALTER TABLE domain_invitations 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN domain_invitations.metadata IS 'Stores additional invitation data like role assignment';
