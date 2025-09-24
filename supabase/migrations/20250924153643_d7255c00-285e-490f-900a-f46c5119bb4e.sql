-- Add new fields to optimizations table for enhanced functionality
ALTER TABLE public.optimizations 
ADD COLUMN optimization_category text NOT NULL DEFAULT 'general',
ADD COLUMN implementation_details jsonb DEFAULT '{}',
ADD COLUMN resources jsonb DEFAULT '[]',
ADD COLUMN success_metrics jsonb DEFAULT '{}',
ADD COLUMN reddit_strategy jsonb DEFAULT '{}',
ADD COLUMN impact_score integer DEFAULT 5,
ADD COLUMN difficulty_level text DEFAULT 'medium',
ADD COLUMN timeline_weeks integer DEFAULT 4;

-- Add check constraints for the new fields
ALTER TABLE public.optimizations 
ADD CONSTRAINT optimizations_category_check 
CHECK (optimization_category IN ('low_visibility', 'general'));

ALTER TABLE public.optimizations 
ADD CONSTRAINT optimizations_difficulty_check 
CHECK (difficulty_level IN ('easy', 'medium', 'hard'));

ALTER TABLE public.optimizations 
ADD CONSTRAINT optimizations_impact_score_check 
CHECK (impact_score >= 1 AND impact_score <= 10);