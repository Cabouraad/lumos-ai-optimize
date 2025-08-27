
-- 1) Pin the search_path for the dashboard refresh function (no behavioral change)
ALTER FUNCTION public.refresh_dashboard_metrics()
  SET search_path = public;

-- 2) Ensure the 'extensions' schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- 3) Move common extensions from 'public' to 'extensions' if present
DO $$
DECLARE
  has_pgcrypto boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto');
  has_uuid boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp');
BEGIN
  IF has_pgcrypto THEN
    BEGIN
      ALTER EXTENSION pgcrypto SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping pgcrypto schema move: %', SQLERRM;
    END;
  END IF;

  IF has_uuid THEN
    BEGIN
      ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping uuid-ossp schema move: %', SQLERRM;
    END;
  END IF;
END $$;
