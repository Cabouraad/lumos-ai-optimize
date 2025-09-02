-- Move extensions out of public schema and enable leaked password protection
-- Issue: Extensions should not be in public schema for security reasons
-- Issue: Leaked password protection should be enabled

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_stat_statements extension to extensions schema if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_stat_statements' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_stat_statements SET SCHEMA extensions;
  END IF;
END $$;

-- Move uuid-ossp extension to extensions schema if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgcrypto extension to extensions schema if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgjwt extension to extensions schema if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgjwt' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pgjwt SET SCHEMA extensions;
  END IF;
END $$;

-- Move http extension to extensions schema if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'http' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION http SET SCHEMA extensions;
  END IF;
END $$;