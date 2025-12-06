-- =============================================
-- VISIBILITY DROP TRACKING SCHEMA
-- =============================================

-- 1. Tracked Keywords Table
CREATE TABLE IF NOT EXISTS public.tracked_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'chatgpt',
  competitor_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, keyword, platform)
);

-- 2. Scan History Table
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id UUID NOT NULL REFERENCES public.tracked_keywords(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER,
  previous_rank INTEGER,
  competitor_name TEXT,
  raw_response TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Email Alert History (to prevent duplicate sends)
CREATE TABLE IF NOT EXISTS public.visibility_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  keyword_id UUID REFERENCES public.tracked_keywords(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL DEFAULT 'visibility_drop',
  email_sent_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  drop_percentage NUMERIC,
  competitor_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_org ON public.tracked_keywords(org_id);
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_active ON public.tracked_keywords(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scan_history_keyword ON public.scan_history(keyword_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created ON public.scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_alerts_org ON public.visibility_alerts(org_id);

-- Enable RLS
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visibility_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracked_keywords
CREATE POLICY "Users can view their org's tracked keywords"
  ON public.tracked_keywords FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = tracked_keywords.org_id
  ));

CREATE POLICY "Users can insert tracked keywords for their org"
  ON public.tracked_keywords FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = tracked_keywords.org_id
  ));

CREATE POLICY "Users can update their org's tracked keywords"
  ON public.tracked_keywords FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = tracked_keywords.org_id
  ));

CREATE POLICY "Users can delete their org's tracked keywords"
  ON public.tracked_keywords FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = tracked_keywords.org_id
  ));

CREATE POLICY "Service role can manage tracked keywords"
  ON public.tracked_keywords FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for scan_history
CREATE POLICY "Users can view their org's scan history"
  ON public.scan_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = scan_history.org_id
  ));

CREATE POLICY "Service role can manage scan history"
  ON public.scan_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for visibility_alerts
CREATE POLICY "Users can view their org's visibility alerts"
  ON public.visibility_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = visibility_alerts.org_id
  ));

CREATE POLICY "Service role can manage visibility alerts"
  ON public.visibility_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_tracked_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_tracked_keywords_timestamp ON public.tracked_keywords;
CREATE TRIGGER update_tracked_keywords_timestamp
  BEFORE UPDATE ON public.tracked_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tracked_keywords_updated_at();

-- Function to detect visibility drops (used by edge function)
CREATE OR REPLACE FUNCTION public.detect_visibility_drops(
  p_org_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 7,
  p_threshold NUMERIC DEFAULT 20
)
RETURNS TABLE (
  org_id UUID,
  user_id UUID,
  keyword_id UUID,
  keyword TEXT,
  brand_name TEXT,
  prompt_text TEXT,
  previous_score NUMERIC,
  current_score NUMERIC,
  previous_rank INTEGER,
  current_rank INTEGER,
  previous_status TEXT,
  current_status TEXT,
  competitor_name TEXT,
  share_loss NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_scans AS (
    SELECT 
      sh.keyword_id,
      sh.score,
      sh.rank,
      sh.competitor_name as comp_name,
      sh.created_at,
      ROW_NUMBER() OVER (PARTITION BY sh.keyword_id ORDER BY sh.created_at DESC) as rn
    FROM scan_history sh
    WHERE sh.created_at > NOW() - (p_days || ' days')::interval
  ),
  comparison AS (
    SELECT
      tk.id as kw_id,
      tk.org_id as tk_org_id,
      tk.user_id as tk_user_id,
      tk.keyword as tk_keyword,
      o.name as org_name,
      curr.score as curr_score,
      prev.score as prev_score,
      curr.rank as curr_rank,
      prev.rank as prev_rank,
      curr.comp_name,
      CASE WHEN prev.score > 0 THEN ((prev.score - curr.score) / prev.score) * 100 ELSE 0 END as drop_pct
    FROM tracked_keywords tk
    JOIN organizations o ON o.id = tk.org_id
    LEFT JOIN latest_scans curr ON curr.keyword_id = tk.id AND curr.rn = 1
    LEFT JOIN latest_scans prev ON prev.keyword_id = tk.id AND prev.rn = 2
    WHERE tk.is_active = true
      AND (p_org_id IS NULL OR tk.org_id = p_org_id)
      AND curr.score IS NOT NULL
      AND prev.score IS NOT NULL
      AND curr.score < prev.score
  )
  SELECT 
    c.tk_org_id,
    c.tk_user_id,
    c.kw_id,
    c.tk_keyword,
    c.org_name,
    c.tk_keyword,
    c.prev_score,
    c.curr_score,
    c.prev_rank,
    c.curr_rank,
    CASE 
      WHEN c.prev_rank = 1 THEN 'Recommended First'
      WHEN c.prev_rank <= 3 THEN 'Top 3'
      ELSE 'Mentioned'
    END,
    CASE 
      WHEN c.curr_rank = 1 THEN 'Recommended First'
      WHEN c.curr_rank <= 3 THEN 'Top 3'
      WHEN c.curr_rank IS NULL THEN 'Not Mentioned'
      ELSE 'Mentioned briefly'
    END,
    c.comp_name,
    c.drop_pct
  FROM comparison c
  WHERE c.drop_pct >= p_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;