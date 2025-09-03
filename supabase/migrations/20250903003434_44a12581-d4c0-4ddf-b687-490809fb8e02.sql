-- Make reports storage bucket private for security
-- Reports should only be accessible via signed URLs

-- Update reports bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'reports';

-- Ensure proper RLS policies are in place for reports bucket
-- Users can only access files in their org's folder via signed URLs