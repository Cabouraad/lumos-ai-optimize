-- Enable realtime updates for llumos_scores table
ALTER TABLE public.llumos_scores REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.llumos_scores;