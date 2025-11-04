-- Add cluster_tag column to prompts table
ALTER TABLE public.prompts 
ADD COLUMN IF NOT EXISTS cluster_tag text;

-- Add index for cluster_tag for filtering
CREATE INDEX IF NOT EXISTS idx_prompts_cluster_tag ON public.prompts(cluster_tag);

-- Add a computed tag color based on cluster name (for UI consistency)
CREATE OR REPLACE FUNCTION get_cluster_tag_color(tag text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF tag IS NULL THEN
    RETURN 'default';
  END IF;
  
  -- Hash the tag to a consistent color
  CASE (hashtext(lower(tag)) % 10)
    WHEN 0 THEN RETURN 'blue';
    WHEN 1 THEN RETURN 'green';
    WHEN 2 THEN RETURN 'purple';
    WHEN 3 THEN RETURN 'orange';
    WHEN 4 THEN RETURN 'pink';
    WHEN 5 THEN RETURN 'cyan';
    WHEN 6 THEN RETURN 'yellow';
    WHEN 7 THEN RETURN 'red';
    WHEN 8 THEN RETURN 'indigo';
    ELSE RETURN 'emerald';
  END CASE;
END;
$$;