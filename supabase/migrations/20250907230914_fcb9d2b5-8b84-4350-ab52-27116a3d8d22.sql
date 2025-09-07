-- Create audit storage tables for automated audit runner
-- These tables store audit run results and events

-- Main audit runs table
CREATE TABLE public.audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed')),
    corr_id TEXT NOT NULL,
    summary JSONB,          -- high level pass/fail per phase
    details JSONB,          -- per-step logs and timings
    artifact_url TEXT,      -- link to html report
    created_by TEXT NOT NULL DEFAULT 'auto'
);

-- Individual audit events table
CREATE TABLE public.audit_events (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.audit_runs(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    phase TEXT,             -- signup|org|pricing|checkout|entitlement|onboarding|dashboard
    name TEXT,              -- event id
    level TEXT,             -- info|warn|error
    data JSONB
);

-- Enable Row Level Security
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_runs
-- Read: authenticated users with admin privileges or test.app email
CREATE POLICY "audit_runs_admin_read" ON public.audit_runs
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            -- Site admins (future feature)
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                AND u.email ILIKE '%@test.app'
            )
            OR
            -- Org owners/admins (existing pattern)
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                AND u.role = 'owner'
            )
        )
    );

-- Write: service role only
CREATE POLICY "audit_runs_service_write" ON public.audit_runs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for audit_events
-- Read: same as audit_runs
CREATE POLICY "audit_events_admin_read" ON public.audit_events
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                AND u.email ILIKE '%@test.app'
            )
            OR
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                AND u.role = 'owner'
            )
        )
    );

-- Write: service role only
CREATE POLICY "audit_events_service_write" ON public.audit_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_audit_runs_started_at ON public.audit_runs(started_at DESC);
CREATE INDEX idx_audit_runs_status ON public.audit_runs(status);
CREATE INDEX idx_audit_events_run_id ON public.audit_events(run_id);
CREATE INDEX idx_audit_events_phase ON public.audit_events(phase);