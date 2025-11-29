import { describe, it, expect } from 'vitest';
import { canUseContentStudio } from '@/features/content-studio/hooks';
import type { ContentStudioItem } from '@/features/content-studio/types';

// Mock content studio item for testing
const mockItem: ContentStudioItem = {
  id: 'test-id-123',
  org_id: 'org-123',
  created_by: 'user-123',
  recommendation_id: null,
  prompt_id: 'prompt-123',
  topic_key: 'Best CRM software for small businesses',
  llm_targets: ['openai_chatgpt', 'perplexity', 'gemini'],
  content_type: 'blog_post',
  outline: {
    title: 'The Complete Guide to CRM Software for Small Businesses',
    sections: [
      {
        heading: 'Introduction',
        points: [
          'Why CRM matters for small businesses',
          'Key benefits of implementing a CRM system',
        ],
        children: [
          {
            heading: 'Common Pain Points',
            points: ['Manual data entry', 'Lost customer information'],
          },
        ],
      },
      {
        heading: 'Top CRM Features',
        points: ['Contact management', 'Pipeline tracking', 'Reporting'],
      },
    ],
  },
  faqs: [
    {
      question: 'What is CRM software?',
      answer_notes: 'Explain CRM as a tool for managing customer relationships and sales pipelines.',
    },
    {
      question: 'How much does CRM software cost?',
      answer_notes: 'Cover pricing tiers from free options to enterprise solutions.',
    },
  ],
  key_entities: ['CRM', 'sales pipeline', 'customer management', 'lead tracking'],
  schema_suggestions: [
    { type: 'Article', notes: 'Use Article schema for the main content structure.' },
    { type: 'FAQPage', notes: 'Include FAQ schema for the questions section.' },
  ],
  tone_guidelines: [
    'Professional but approachable',
    'Use concrete examples',
    'Avoid jargon where possible',
  ],
  status: 'draft',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

describe('Content Studio - Tier Access', () => {
  describe('canUseContentStudio', () => {
    it('should return true for Growth tier', () => {
      expect(canUseContentStudio('growth')).toBe(true);
      expect(canUseContentStudio('Growth')).toBe(true);
      expect(canUseContentStudio('GROWTH')).toBe(true);
    });

    it('should return true for Pro tier', () => {
      expect(canUseContentStudio('pro')).toBe(true);
      expect(canUseContentStudio('Pro')).toBe(true);
      expect(canUseContentStudio('PRO')).toBe(true);
    });

    it('should return true for Enterprise tier', () => {
      expect(canUseContentStudio('enterprise')).toBe(true);
      expect(canUseContentStudio('Enterprise')).toBe(true);
    });

    it('should return false for Starter tier', () => {
      expect(canUseContentStudio('starter')).toBe(false);
      expect(canUseContentStudio('Starter')).toBe(false);
    });

    it('should return false for Free tier', () => {
      expect(canUseContentStudio('free')).toBe(false);
      expect(canUseContentStudio('Free')).toBe(false);
    });

    it('should return false for null or undefined tier', () => {
      expect(canUseContentStudio(null)).toBe(false);
      expect(canUseContentStudio(undefined)).toBe(false);
      expect(canUseContentStudio('')).toBe(false);
    });
  });
});

// Note: Component rendering tests require additional setup with providers
// These are kept as unit tests for the tier access logic

describe('Content Studio - Types', () => {
  it('should have valid content types', () => {
    const validTypes = ['faq_page', 'blog_post', 'landing_page', 'support_article', 'comparison_page'];
    expect(validTypes).toContain(mockItem.content_type);
  });

  it('should have valid schema types', () => {
    const validSchemaTypes = ['FAQPage', 'Article', 'Product', 'HowTo'];
    mockItem.schema_suggestions.forEach((suggestion) => {
      expect(validSchemaTypes).toContain(suggestion.type);
    });
  });

  it('should have valid status', () => {
    const validStatuses = ['draft', 'in_progress', 'completed'];
    expect(validStatuses).toContain(mockItem.status);
  });
});
