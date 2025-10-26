-- Grant execute permission on competitor summary function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_competitor_summary_v2(uuid, integer, integer, integer, text[]) 
TO authenticated;