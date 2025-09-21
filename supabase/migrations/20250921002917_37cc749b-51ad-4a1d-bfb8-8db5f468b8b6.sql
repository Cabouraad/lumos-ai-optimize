-- Enforce case-insensitive uniqueness on users.email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_ci ON public.users (LOWER(email));