-- 1) Cleanup orphaned duplicate for the affected email
DELETE FROM public.users u
WHERE lower(u.email) = lower('abouraa.chri@gmail.com')
  AND (
    NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)
    OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = u.org_id)
  );

-- 2) Guardrail: prevent future duplicates (case-insensitive) via trigger
CREATE OR REPLACE FUNCTION public.prevent_duplicate_users_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow NULL emails to pass (shouldn't be null in practice)
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block duplicates case-insensitively, excluding the same row by id
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(u.email) = lower(NEW.email)
      AND u.id <> NEW.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'A user with email % already exists', NEW.email
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_users_email ON public.users;
CREATE TRIGGER trg_prevent_duplicate_users_email
BEFORE INSERT OR UPDATE OF email ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_users_email();