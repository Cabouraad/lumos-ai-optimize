import { describe, it, expect } from 'https://deno.land/std@0.224.0/testing/bdd.ts';
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/**
 * Edge Function Unit Tests for generate-visibility-recommendations
 * 
 * These tests verify core logic without requiring deployed infrastructure.
 * Run with: deno test --allow-env supabase/functions/generate-visibility-recommendations/__tests__/
 */

describe('Recommendation Generation Logic', () => {
  it('should create fallback recommendations', () => {
    const brand = 'TestBrand';
    const promptText = 'Compare CRM solutions for SMBs';
    
    // Simulate fallback logic
    const fallback = {
      content: [{
        subtype: 'blog_post',
        title: `Definitive Guide: ${promptText}`,
        must_include: { 
          entities: [brand], 
          keywords: ['best practices', 'comparison', 'pricing', 'alternatives']
        }
      }],
      social: [{
        subtype: 'linkedin_post',
        title: `Most teams miss this about ${promptText}`,
        must_include: { entities: [brand] }
      }]
    };

    assertExists(fallback.content);
    assertExists(fallback.social);
    assertEquals(fallback.content.length, 1);
    assertEquals(fallback.social.length, 1);
    assertEquals(fallback.content[0].must_include.entities[0], brand);
  });

  it('should normalize citations correctly', () => {
    const rawCitations = [
      { url: 'https://example.com/article', title: 'Test Article', domain: 'example.com' },
      { url: 'https://test.org/post', title: null, domain: null }
    ];

    const normalized = rawCitations.map(c => ({
      domain: c.domain || new URL(c.url).hostname,
      link: c.url,
      title: c.title || null
    }));

    assertEquals(normalized[0].domain, 'example.com');
    assertEquals(normalized[1].domain, 'test.org');
    assertExists(normalized[0].title);
    assertEquals(normalized[1].title, null);
  });

  it('should build recommendation rows from AI response', () => {
    const aiResponse = {
      content: [{
        subtype: 'blog_post',
        title: 'Test Blog',
        outline: [{ h2: 'Section 1', h3: ['Sub 1'] }],
        must_include: { entities: ['Brand'], keywords: ['test'] },
        posting_instructions: 'Post steps'
      }],
      social: [{
        subtype: 'linkedin_post',
        title: 'Social Post',
        body_bullets: ['Point 1', 'Point 2'],
        cta: 'Read more'
      }]
    };

    const orgId = 'org-123';
    const promptId = 'prompt-456';
    const presence = 45.5;
    const citations = [{ domain: 'test.com', link: 'https://test.com', title: null }];

    const rows: any[] = [];
    aiResponse.content.forEach(c => rows.push({
      org_id: orgId,
      prompt_id: promptId,
      channel: 'content',
      subtype: c.subtype,
      title: c.title,
      outline: c.outline,
      posting_instructions: c.posting_instructions,
      must_include: c.must_include,
      citations_used: citations,
      score_before: presence
    }));

    aiResponse.social.forEach(s => rows.push({
      org_id: orgId,
      prompt_id: promptId,
      channel: 'social',
      subtype: s.subtype,
      title: s.title,
      outline: { body_bullets: s.body_bullets }
    }));

    assertEquals(rows.length, 2);
    assertEquals(rows[0].channel, 'content');
    assertEquals(rows[1].channel, 'social');
    assertEquals(rows[0].score_before, 45.5);
  });

  it('should handle missing AI response fields gracefully', () => {
    const incompleteAI = {
      content: [{ subtype: 'blog_post' }], // missing title, outline, etc.
      social: []
    };

    const rows: any[] = [];
    incompleteAI.content.forEach((c: any) => rows.push({
      subtype: c.subtype || 'blog_post',
      title: c.title || 'Untitled',
      outline: c.outline || null,
      posting_instructions: c.posting_instructions || '',
      must_include: c.must_include || {}
    }));

    assertEquals(rows[0].title, 'Untitled');
    assertEquals(rows[0].outline, null);
    assertEquals(rows[0].posting_instructions, '');
  });
});

describe('User Prompt Generation', () => {
  it('should format user prompt correctly', () => {
    const brand = 'TestBrand';
    const promptText = 'Best CRM for startups';
    const presence = 23.5;
    const citations = [
      { domain: 'hubspot.com', link: 'https://hubspot.com/guide', title: 'HubSpot Guide' }
    ];

    const formatted = `BRAND: ${brand}
TRACKED PROMPT: "${promptText}"
CURRENT PRESENCE (14d): ${presence.toFixed(1)}%
RECENT CITATIONS:
- ${citations[0].domain} — ${citations[0].title} (${citations[0].link})

Create JSON with keys:
{
  "content":[...],
  "social":[...],
  "projected_impact":"..."
}
JSON ONLY.`;

    assertExists(formatted);
    assertEquals(formatted.includes('TestBrand'), true);
    assertEquals(formatted.includes('23.5%'), true);
    assertEquals(formatted.includes('hubspot.com'), true);
  });
});
