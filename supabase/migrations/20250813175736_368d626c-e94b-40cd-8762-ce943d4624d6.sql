-- Update llm_providers RLS policy to require authentication
DROP POLICY IF EXISTS "llm_providers_read" ON public.llm_providers;

CREATE POLICY "llm_providers_read" ON public.llm_providers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()
    )
  );