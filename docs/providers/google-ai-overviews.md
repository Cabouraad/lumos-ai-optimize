# Google AI Overviews Integration

Google AI Overviews (AIO) provides insights into how your brand appears in Google's AI-powered search results and answer boxes.

## Overview

When enabled, Llumos analyzes your brand's presence in Google's AI Overview results, helping you understand:

- **Brand Visibility**: How often your brand appears in AI-generated summaries
- **Competitive Analysis**: Which competitors are mentioned alongside your brand
- **Citation Analysis**: What sources Google's AI uses when mentioning your brand
- **Trend Tracking**: Weekly changes in AI Overview presence

## Configuration

### Prerequisites

1. **SerpApi Account**: You need a valid SerpApi account and API key
2. **Pro Subscription**: Google AI Overviews is available for Pro tier subscribers only
3. **Server Configuration**: Your administrator must enable the feature server-side

### Environment Variables

```bash
# Required for Google AI Overviews
SERPAPI_KEY=your_serpapi_key_here
ENABLE_GOOGLE_AIO=true

# Optional: Control AIO weight in scoring (default: 1.0)
WEIGHT_AIO=1.0
```

### Supabase Secrets

The following secrets must be configured in your Supabase project:

- `SERPAPI_KEY`: Your SerpApi API key
- `ENABLE_GOOGLE_AIO`: Set to 'true' to enable the feature

## How It Works

1. **Query Execution**: When you run a prompt, Llumos sends it to Google's search API via SerpApi
2. **AI Overview Extraction**: The system extracts AI Overview content and citations
3. **Brand Analysis**: Citations are analyzed for brand and competitor mentions
4. **Scoring Integration**: AIO results contribute to your overall visibility score
5. **Reporting**: Results appear in your dashboard and weekly reports

## Rate Limits & Costs

### SerpApi Limits
- **Free Tier**: 100 searches/month
- **Paid Plans**: Various limits based on subscription
- **Rate Limiting**: 10 requests/second maximum

### Cost Considerations
- Each prompt execution = 1 SerpApi search credit
- Monitor your SerpApi usage in their dashboard
- Consider prompt volume when choosing SerpApi plan

## Geographic & Language Settings

AIO supports geographic and language targeting:

```typescript
// Default settings
{
  gl: 'us',    // Geographic location
  hl: 'en'     // Host language
}

// Available options
gl: 'us' | 'uk' | 'ca' | 'au' | 'de' | 'fr' | ...
hl: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | ...
```

## Data Structure

### AIO Result Format
```typescript
interface AioResult {
  summary: string;                    // AI-generated summary text
  citations: Array<{                 // Source citations
    title?: string;
    link: string;
    domain?: string;
  }>;
  follow_up_questions?: string[];     // Related questions
  raw?: unknown;                      // Full SerpApi response
}
```

### Citation Processing
Citations are automatically processed to:
- Extract domain names for brand matching
- Filter duplicate sources
- Map to your brand catalog
- Identify competitor mentions

## UI Elements

### Provider Badges
AIO results are marked with a **G-AIO** badge in:
- Prompt result cards
- Citation lists
- Provider selection interfaces

### Reports Integration
Weekly reports include:
- AIO visibility trends
- New competitor discoveries
- Citation source analysis
- Geographic performance (if configured)

## Troubleshooting

### Common Issues

1. **No Results Returned**
   - Check if `ENABLE_GOOGLE_AIO=true`
   - Verify SerpApi key is valid
   - Ensure Pro subscription is active

2. **Rate Limit Errors**
   - Check SerpApi usage dashboard
   - Reduce prompt execution frequency
   - Upgrade SerpApi plan if needed

3. **Empty AI Overviews**
   - Not all queries trigger AI Overviews
   - Try more commercial/informational queries
   - Some regions have limited AIO coverage

### Debug Logging
Enable debug logging in development:
```bash
FEATURE_GOOGLE_AIO=true
```

## Best Practices

### Query Optimization
- Use natural, conversational queries
- Include your brand name in prompts
- Focus on informational or commercial intent
- Test different geographic locations

### Monitoring
- Track SerpApi usage regularly
- Monitor AIO availability for your queries
- Review weekly trend reports
- Adjust weight settings based on results

### Compliance
- Use only compliant SERP API providers
- Never scrape Google directly from client-side
- Respect rate limits and ToS
- Monitor for policy changes

## Disabling AIO

To disable Google AI Overviews:

1. **Server-side**: Set `ENABLE_GOOGLE_AIO=false`
2. **Organization-level**: Use the Settings → Integrations toggle
3. **Temporary**: Remove or invalidate `SERPAPI_KEY`

When disabled, existing behavior is unchanged and no AIO queries are executed.

## Support

For technical issues:
- Check Supabase function logs
- Review SerpApi dashboard for errors
- Contact support with correlation IDs
- Include relevant prompt IDs in reports

For billing questions:
- Monitor SerpApi usage dashboard
- Review Llumos subscription tier
- Contact billing support for plan changes