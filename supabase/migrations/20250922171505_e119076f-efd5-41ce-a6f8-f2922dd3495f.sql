-- Move pg_cron extension out of public schema for security
-- This prevents potential security issues with cron jobs in public schema
DROP EXTENSION IF EXISTS pg_cron CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;