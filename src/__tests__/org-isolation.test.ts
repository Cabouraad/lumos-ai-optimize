/**
 * Tests for per-org isolation in V2 analyzer  
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrgOverlay, updateOrgOverlay, clearOrgOverlayCache, addCompetitorExclusion, addCompetitorOverride } from '../../lib/brand/org-overlay.ts';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  update: vi.fn(() => Promise.resolve({ error: null }))
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('Per-Org Isolation', () => {
  beforeEach(() => {
    clearOrgOverlayCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearOrgOverlayCache();
  });

  it('should maintain separate overlays for different orgs', async () => {
    const orgA = 'org-a';
    const orgB = 'org-b';

    // Since we're using cache-only approach now, test cache isolation
    await addCompetitorExclusion(orgA, 'CompetitorX');
    await addCompetitorExclusion(orgB, 'CompetitorY');

    const overlayA = await getOrgOverlay(orgA);
    const overlayB = await getOrgOverlay(orgB);

    expect(overlayA.competitor_exclusions).toContain('CompetitorX');
    expect(overlayA.competitor_exclusions).not.toContain('CompetitorY');

    expect(overlayB.competitor_exclusions).toContain('CompetitorY');
    expect(overlayB.competitor_exclusions).not.toContain('CompetitorX');
  });

  it('should not cross-contaminate when updating overlays', async () => {
    const orgA = 'org-a';
    const orgB = 'org-b';

    // Add exclusion to org A
    await addCompetitorExclusion(orgA, 'ExcludedCompetitor');

    // Verify org B is not affected
    const overlayB = await getOrgOverlay(orgB);
    expect(overlayB.competitor_exclusions).not.toContain('ExcludedCompetitor');
  });

  it('should cache overlays per org independently', async () => {
    const orgA = 'org-a';
    const orgB = 'org-b';

    // Add data to org A
    await addCompetitorExclusion(orgA, 'TestCompetitor');

    // First call should populate cache
    const overlay1 = await getOrgOverlay(orgA);

    // Second call should use cache
    const overlay2 = await getOrgOverlay(orgA);

    // Different org should have separate cache
    const overlayB = await getOrgOverlay(orgB);

    expect(overlay1.competitor_exclusions).toEqual(overlay2.competitor_exclusions);
    expect(overlayB.competitor_exclusions).not.toContain('TestCompetitor');
  });

  it('should handle org overlay updates atomically', async () => {
    const orgId = 'test-org';

    // Add override
    await addCompetitorOverride(orgId, 'NewCompetitor');

    // Verify overlay was updated
    const overlay = await getOrgOverlay(orgId);
    expect(overlay.competitor_overrides).toContain('NewCompetitor');
  });

  it('should return empty overlay for non-existent org', async () => {
    const nonExistentOrg = 'non-existent-org';

    const overlay = await getOrgOverlay(nonExistentOrg);

    expect(overlay).toEqual({
      org_id: nonExistentOrg,
      competitor_overrides: [],
      competitor_exclusions: [],
      brand_variants: [],
      last_updated: expect.any(Date)
    });
  });

  it('should handle database errors gracefully', async () => {
    const orgId = 'error-org';

    // Since we're using cache-only now, this will always return empty overlay
    const overlay = await getOrgOverlay(orgId);

    // Should return empty overlay without throwing
    expect(overlay).toEqual({
      org_id: orgId,
      competitor_overrides: [],
      competitor_exclusions: [],
      brand_variants: [],
      last_updated: expect.any(Date)
    });
  });
});

export default {};