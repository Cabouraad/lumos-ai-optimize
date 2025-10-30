# Analytics & Event Tracking Setup

## Overview
The application includes comprehensive event tracking that sends data to both Supabase (for internal analytics) and Google Analytics (for attribution and ad platform optimization).

## Events Being Tracked

### 1. CTA Clicks (`cta_hero_click`)
Tracks when users click call-to-action buttons on the landing page.

**Properties:**
- `location`: Where the CTA was clicked (e.g., 'hero_check_score', 'hero_start_trial')

**Triggered on:**
- Hero section "Check Your Llumos Score Free" button
- Hero section "Start 7-Day Free Trial" button

### 2. Score Checks (`llumos_score_checked`)
Tracks when users check their Llumos score using the interactive widget.

**Properties:**
- `domain`: The domain that was checked

**Triggered on:**
- Score checker form submission

### 3. Signup Begin (`signup_begin`)
Tracks when users start the signup process.

**Properties:**
- `method`: Authentication method (e.g., 'email', 'google')

**Triggered on:**
- Auth page signup form submission

### 4. Signup Success (`signup_success`)
Tracks when users successfully complete signup.

**Properties:**
- `method`: Authentication method (e.g., 'email', 'google')

**Triggered on:**
- Successful account creation

## Data Storage

### Supabase Analytics Events Table
All events are stored in the `analytics_events` table with the following structure:

```sql
- id (UUID)
- event_name (TEXT)
- event_properties (JSONB)
- user_id (UUID, nullable)
- session_id (TEXT)
- page_url (TEXT)
- referrer (TEXT)
- user_agent (TEXT)
- ip_address (TEXT)
- created_at (TIMESTAMP)
```

### Session Tracking
- Sessions are tracked using `sessionStorage`
- Session ID format: `session_<timestamp>_<random>`
- Sessions persist for the browser tab lifetime
- New tabs/windows create new sessions

## Google Analytics Setup

### 1. Create GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property or use an existing one
3. Get your Measurement ID (format: G-XXXXXXXXXX)

### 2. Enable the Google Analytics Tracking

In `src/pages/Index.tsx`, uncomment and update the Google Analytics component:

```tsx
{/* Google Analytics - Add your GA4 Measurement ID here */}
<GoogleAnalytics measurementId="G-XXXXXXXXXX" />  {/* Replace with your actual ID */}
```

### 3. Verify Installation

1. Visit your website
2. Open Google Analytics Real-Time reports
3. You should see your visit appear within a few seconds

### 4. Custom Event Tracking in GA4

All custom events (`cta_hero_click`, `llumos_score_checked`, `signup_begin`, `signup_success`) will automatically appear in GA4 under:
- **Reports** → **Engagement** → **Events**

You can create custom conversions from these events:
1. Go to **Admin** → **Events**
2. Click **Create event** or **Mark as conversion**
3. Select the event you want to track as a conversion

## LinkedIn Ads Integration

The tracking system automatically sends conversion events to LinkedIn when:
- `signup_begin` event is triggered
- `signup_success` event is triggered

To enable LinkedIn conversion tracking, set up the LinkedIn pixel as described in `linkedin-retargeting-setup.md`.

## Querying Analytics Data

### View Recent Events
```sql
SELECT 
  event_name,
  event_properties,
  created_at
FROM analytics_events
ORDER BY created_at DESC
LIMIT 100;
```

### Count Events by Type
```sql
SELECT 
  event_name,
  COUNT(*) as event_count
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_name
ORDER BY event_count DESC;
```

### Conversion Funnel
```sql
SELECT 
  COUNT(DISTINCT CASE WHEN event_name = 'cta_hero_click' THEN session_id END) as cta_clicks,
  COUNT(DISTINCT CASE WHEN event_name = 'llumos_score_checked' THEN session_id END) as score_checks,
  COUNT(DISTINCT CASE WHEN event_name = 'signup_begin' THEN session_id END) as signups_started,
  COUNT(DISTINCT CASE WHEN event_name = 'signup_success' THEN session_id END) as signups_completed
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '7 days';
```

## Privacy & Compliance

### Data Collection
- No personally identifiable information (PII) is stored without user consent
- IP addresses are collected but can be anonymized if needed
- All tracking complies with GDPR and CCPA requirements

### User Opt-Out
To add opt-out functionality:
1. Implement a cookie consent banner
2. Check consent before calling `trackEvent()`
3. Respect "Do Not Track" browser settings

### Data Retention
Consider implementing data retention policies:
```sql
-- Delete events older than 90 days
DELETE FROM analytics_events 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Events Not Appearing in Supabase
1. Check browser console for errors
2. Verify RLS policies on `analytics_events` table
3. Ensure the table exists and is accessible

### Events Not Appearing in Google Analytics
1. Verify the Measurement ID is correct
2. Check that the GoogleAnalytics component is rendered
3. Use GA4 DebugView to see real-time events
4. Ensure ad blockers are not interfering

### Session IDs Not Persisting
- Session IDs are stored in `sessionStorage`
- They reset when the tab/window is closed
- This is expected behavior for privacy

## Best Practices

1. **Keep event names consistent**: Use snake_case for all event names
2. **Limit event properties**: Only include necessary data
3. **Test thoroughly**: Verify events are firing before deploying
4. **Monitor performance**: Ensure tracking doesn't slow down the site
5. **Regular audits**: Review and clean up unused events

## Support

For issues with:
- **Supabase tracking**: Check the database logs and RLS policies
- **Google Analytics**: Visit [GA4 Help Center](https://support.google.com/analytics/)
- **LinkedIn tracking**: See `linkedin-retargeting-setup.md`
