# Edge Functions Overview

This document lists all edge functions in the project, their purpose, and how to test them.

## Core Functions

### 1. **generate-visibility-recommendations**
**Purpose**: Generates actionable content and social recommendations using OpenAI
**Input**: `{ promptId: string }` or `{ batch: true }`
**Output**: `{ inserted: number, recommendations: any[] }`
**Auth**: Required (JWT)
**Key Features**:
- Calls OpenAI GPT-4o-mini for intelligent recommendations
- Has deterministic fallback if OpenAI fails
- Creates content (blog posts, resource hubs, landing pages)
- Creates social recommendations (LinkedIn, X posts)
- Stores results in `ai_visibility_recommendations` table

### 2. **run-prompt-now**
**Purpose**: Executes a prompt across all enabled AI providers immediately
**Input**: `{ promptId: string }`
**Output**: `{ totalRuns: number, successfulRuns: number }`
**Auth**: Required (JWT)
**Key Features**:
- Runs on OpenAI, Perplexity, Gemini, Google AIO
- Performs brand detection and competitor analysis
- Enforces subscription tier limits
- Tracks token usage and costs

### 3. **llms-generate**
**Purpose**: Generates llms.txt file by crawling organization's website
**Input**: None (uses authenticated user's org)
**Output**: `{ success: boolean, content: string, source: string }`
**Auth**: Required (JWT)
**Key Features**:
- Discovers pages via sitemap
- Crawls with Firecrawl API (with fallback to direct fetch)
- Generates structured llms.txt content
- Stores in `organizations.llms_txt`

### 4. **diag**
**Purpose**: Diagnostic endpoint to check environment variables and auth
**Input**: None
**Output**: `{ ok: true, hasBearer: boolean, env: {...} }`
**Auth**: Optional (for testing)
**Key Features**:
- Checks CORS configuration
- Validates environment variables
- No side effects (read-only)

## Scheduled Functions

### 5. **daily-batch-trigger**
**Purpose**: Cron job that triggers daily batch processing
**Schedule**: Daily
**Auth**: CRON_SECRET required

### 6. **robust-batch-processor**
**Purpose**: Processes prompts in batches with retry logic
**Key Features**:
- Idempotency protection
- Correlation IDs for tracking
- Handles failures gracefully

### 7. **batch-reconciler**
**Purpose**: Verifies batch completeness and self-heals
**Schedule**: After daily batch
**Key Features**:
- Coverage verification
- Gap detection and filling

### 8. **scheduler-postcheck**
**Purpose**: Validates scheduler execution completeness
**Schedule**: After scheduled runs

## User Management

### 9. **bootstrap-auth**
**Purpose**: Creates user profile and organization on signup
**Trigger**: Auth webhook
**Key Features**:
- Creates `users` record
- Creates default organization
- Sets up initial configuration

### 10. **ensure-user-record**
**Purpose**: Ensures user record exists (fallback)
**Auth**: Required (JWT)

### 11. **delete-account**
**Purpose**: Deletes user account and all associated data
**Auth**: Required (JWT)
**Key Features**:
- Cascade deletes org data
- Removes all user traces

## Subscription & Billing

### 12. **create-checkout**
**Purpose**: Creates Stripe checkout session for subscription
**Input**: `{ priceId: string, orgId: string }`
**Output**: `{ url: string }` (Stripe checkout URL)
**Auth**: Required (JWT)

### 13. **customer-portal**
**Purpose**: Creates Stripe customer portal session
**Auth**: Required (JWT)

### 14. **check-subscription**
**Purpose**: Checks subscription status and updates tier
**Auth**: Required (JWT)

### 15. **check-subscription-scheduled**
**Purpose**: Scheduled check for all subscriptions
**Schedule**: Hourly

### 16. **activate-trial**
**Purpose**: Activates trial period for organization
**Auth**: Admin only

## Recommendations & Optimizations

### 17. **generate-recommendations**
**Purpose**: Generates basic recommendations (legacy)
**Status**: Being replaced by `generate-visibility-recommendations`

### 18. **intelligent-recommendations**
**Purpose**: AI-powered recommendations with context
**Auth**: Required (JWT)

### 19. **advanced-recommendations**
**Purpose**: Advanced recommendation generation
**Auth**: Required (JWT)

### 20. **reco-refresh**
**Purpose**: Refreshes all recommendations for an org
**Auth**: Required (JWT)

### 21. **enqueue-optimizations**
**Purpose**: Queues optimization generation jobs
**Auth**: Required (JWT)

### 22. **optimization-worker**
**Purpose**: Processes queued optimization jobs
**Trigger**: Queue-based

## Data Management

### 23. **analyze-ai-response**
**Purpose**: Analyzes AI responses for brand mentions
**Auth**: Required (JWT)

### 24. **citation-mention**
**Purpose**: Extracts citations from AI responses
**Auth**: Required (JWT)

### 25. **brand-enrich**
**Purpose**: Enriches brand data with external sources
**Auth**: Required (JWT)

### 26. **convert-competitor-to-brand**
**Purpose**: Converts competitor entry to tracked brand
**Auth**: Required (JWT)

## Debugging & Diagnostics

### 27. **debug-response-data**
**Purpose**: Debug tool to inspect response data
**Auth**: Admin only

### 28. **scheduler-diagnostics**
**Purpose**: Provides scheduler health metrics
**Auth**: Admin only

## Onboarding

### 29. **onboarding**
**Purpose**: Handles user onboarding flow
**Auth**: Required (JWT)
**Key Features**:
- Collects business context
- Sets up initial prompts
- Configures organization

### 30. **auto-fill-business-context**
**Purpose**: Auto-fills business context from website
**Auth**: Required (JWT)

## Reports

### 31. **generate-weekly-report**
**Purpose**: Generates weekly visibility report
**Auth**: Required (JWT)

### 32. **backfill-weekly-reports**
**Purpose**: Backfills historical weekly reports
**Auth**: Admin only

### 33. **reports-sign**
**Purpose**: Creates signed URLs for report files
**Auth**: Required (JWT)

## Utilities

### 34. **free-visibility-checker**
**Purpose**: Checks visibility for free tier users
**Auth**: Required (JWT)

### 35. **fetch-google-aio**
**Purpose**: Fetches Google AI Overview results
**Auth**: Required (JWT)

### 36. **fix-org-brand-misclassification**
**Purpose**: Fixes brand classification errors
**Auth**: Admin only

### 37. **fix-prompt-classification**
**Purpose**: Fixes prompt classification errors
**Auth**: Admin only

## Manual Triggers (Admin Only)

### 38. **manual-daily-run**
### 39. **manual-recovery-trigger**
### 40. **admin-batch-trigger**
### 41. **scheduler-recovery**
### 42. **schedule-dry-run**

## Access Control (Admin Only)

### 43. **grant-starter-bypass**
### 44. **remove-bypass**
### 45. **remove-test-access**

## Testing

To test any function:

```bash
# Local testing with Supabase CLI
supabase functions serve function-name --env-file .env.local

# Test with curl
curl -X POST \
  http://localhost:54321/functions/v1/function-name \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Environment Variables Required

Most functions require:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Additional keys by function:
- **OpenAI functions**: `OPENAI_API_KEY`
- **Perplexity**: `PERPLEXITY_API_KEY`
- **Gemini**: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Firecrawl**: `FIRECRAWL_API_KEY`
- **Scheduled functions**: `CRON_SECRET`
- **CORS**: `APP_ORIGIN` or `APP_ORIGINS`
