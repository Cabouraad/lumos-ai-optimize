-- Add unique constraint for deduplication in optimizations_v2
-- This allows upsert operations to work correctly with ON CONFLICT

-- First, ensure there are no duplicate records before adding the constraint
-- Delete older duplicates keeping the most recent one
DELETE FROM optimizations_v2 a USING optimizations_v2 b
WHERE a.id < b.id 
  AND a.org_id = b.org_id 
  AND a.content_hash = b.content_hash;

-- Add the unique constraint
ALTER TABLE optimizations_v2
ADD CONSTRAINT optimizations_v2_org_content_unique 
UNIQUE (org_id, content_hash);