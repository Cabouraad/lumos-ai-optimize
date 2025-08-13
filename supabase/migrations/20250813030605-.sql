-- Fix function search path security issues

CREATE OR REPLACE FUNCTION assert_service_for_user_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can modify users';
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION normalize_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  new.domain := lower(trim(new.domain));
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION assert_service_for_org_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can insert organizations';
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION prevent_domain_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF (old.domain_locked_at IS NOT NULL) AND (new.domain <> old.domain) THEN
    RAISE EXCEPTION 'Domain is locked and cannot be changed';
  END IF;
  RETURN new;
END $$;