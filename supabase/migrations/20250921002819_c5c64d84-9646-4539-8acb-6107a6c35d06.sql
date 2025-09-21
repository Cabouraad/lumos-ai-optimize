-- Cleanup duplicates across all emails by keeping the most recent record per email (case-insensitive)
WITH ranked AS (
  SELECT id, email, created_at,
         ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC, id DESC) AS rn
  FROM users
)
DELETE FROM users u
USING ranked r
WHERE u.id = r.id AND r.rn > 1;