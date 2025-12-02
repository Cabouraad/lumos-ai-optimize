/**
 * Content Studio Types
 * Feature for Growth & Pro tiers to generate content blueprints from low-visibility recommendations
 */

export interface OutlineSection {
  heading: string;
  points: string[];
  children?: OutlineSection[];
}

export interface ContentOutline {
  title: string;
  sections: OutlineSection[];
}

export interface FAQ {
  question: string;
  answer_notes: string;
}

export interface SchemaSuggestion {
  type: 'FAQPage' | 'Article' | 'Product' | 'HowTo';
  notes: string;
}

export type ContentType = 'faq_page' | 'blog_post' | 'landing_page' | 'support_article' | 'comparison_page';

export interface ContentStudioItem {
  id: string;
  org_id: string;
  created_by: string;
  recommendation_id: string | null;
  prompt_id: string | null;
  topic_key: string;
  llm_targets: string[];
  content_type: ContentType;
  outline: ContentOutline;
  faqs: FAQ[];
  key_entities: string[];
  schema_suggestions: SchemaSuggestion[];
  tone_guidelines: string[];
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ContentPreferences {
  tone: string;
  style: string;
  audience: string;
  format?: string;
}

export interface GenerateContentStudioRequest {
  recommendationId?: string;
  promptId?: string;
  preferences?: ContentPreferences;
}

export interface GenerateContentStudioResponse {
  success: boolean;
  item?: ContentStudioItem;
  error?: string;
  upgradeRequired?: boolean;
  currentTier?: string;
}

// Content type display labels
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  faq_page: 'FAQ Page',
  blog_post: 'Blog Post',
  landing_page: 'Landing Page',
  support_article: 'Support Article',
  comparison_page: 'Comparison Page',
};

// Schema type colors for badges
export const SCHEMA_TYPE_COLORS: Record<string, string> = {
  FAQPage: 'bg-blue-100 text-blue-700 border-blue-200',
  Article: 'bg-green-100 text-green-700 border-green-200',
  Product: 'bg-purple-100 text-purple-700 border-purple-200',
  HowTo: 'bg-orange-100 text-orange-700 border-orange-200',
};
