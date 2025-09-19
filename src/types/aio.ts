/**
 * Google AI Overviews types and interfaces
 */

export interface AioResult {
  summary: string;
  citations: Array<{
    title?: string;
    link: string;
    domain?: string;
  }>;
  follow_up_questions?: string[];
  raw?: unknown;
}

export interface AioRequest {
  query: string;
  gl?: string; // Geographic location (default: 'us')
  hl?: string; // Host language (default: 'en')
}

export interface AioCitation {
  title?: string;
  link: string;
  domain?: string;
  source_provider: 'google_ai_overview';
}