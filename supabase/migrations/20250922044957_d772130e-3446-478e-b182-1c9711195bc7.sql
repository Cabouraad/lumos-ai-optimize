-- Move extensions from public schema to extensions schema
-- This addresses the security linter warning about extensions in public

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move relocatable extensions from public to extensions schema
DO $$ 
DECLARE 
  ext_name text;
BEGIN
  -- Get all extensions currently in public schema
  FOR ext_name IN 
    SELECT e.extname 
    FROM pg_extension e 
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE n.nspname = 'public'
      AND e.extrelocatable = true
  LOOP
    -- Move extension to extensions schema
    EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
    RAISE NOTICE 'Moved extension % to extensions schema', ext_name;
  END LOOP;
END $$;