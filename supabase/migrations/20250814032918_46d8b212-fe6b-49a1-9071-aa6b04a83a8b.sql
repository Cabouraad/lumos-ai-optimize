-- Allow null values for org_brand_prominence in visibility_results table
-- This is needed when a brand is not found in the AI response
ALTER TABLE visibility_results 
ALTER COLUMN org_brand_prominence DROP NOT NULL;