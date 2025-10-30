# LinkedIn Retargeting Setup

## Overview
The exit-intent popup includes support for LinkedIn retargeting campaigns. This allows you to run "visited-but-didn't-sign-up" campaigns to re-engage visitors who showed interest but didn't convert.

## Setup Instructions

### 1. Get Your LinkedIn Partner ID

1. Go to [LinkedIn Campaign Manager](https://www.linkedin.com/campaignmanager)
2. Navigate to **Account Assets** → **Insight Tag**
3. Create or access your Insight Tag
4. Your Partner ID will be displayed (format: 7-digit number)

### 2. Enable the LinkedIn Pixel

In `src/pages/Index.tsx`, uncomment and update the LinkedIn pixel component:

```tsx
{/* LinkedIn Retargeting Pixel - Add your Partner ID here */}
<LinkedInPixel partnerId="1234567" />  {/* Replace with your actual Partner ID */}
```

### 3. Verify Installation

1. Install the [LinkedIn Insight Tag Helper Chrome Extension](https://chrome.google.com/webstore/detail/linkedin-insight-tag-help/pgfbienbfbdmhkgejhimmnmgodihchjb)
2. Visit your website
3. The extension should show a green checkmark if the pixel is firing correctly

## Tracked Events

The implementation tracks the following events:

- **Page View**: Automatically tracked when the pixel loads
- **Lead Captured**: Fired when a user submits the exit-intent popup form

## Creating Retargeting Campaigns

Once the pixel is installed and collecting data, you can create retargeting campaigns in LinkedIn Campaign Manager:

1. Create a new campaign
2. Under **Audience**, select **Website retargeting**
3. Create custom audiences based on:
   - All website visitors
   - Visitors who did NOT convert (use exclusion rules)
   - Time-based segments (last 30/60/90 days)

## Privacy & Compliance

The LinkedIn pixel complies with GDPR and privacy regulations:
- It uses first-party cookies
- No personal data is sent without user consent
- Users can opt-out via LinkedIn's privacy settings

## Testing

To test the implementation:

1. Visit your site in an incognito window
2. Trigger the exit-intent popup (move cursor to leave the page or wait 45 seconds)
3. Submit the form
4. Check LinkedIn Campaign Manager → Matched Audiences to verify pixel activity

## Support

For issues with the LinkedIn pixel:
- [LinkedIn Insight Tag Documentation](https://business.linkedin.com/marketing-solutions/insight-tag)
- [LinkedIn Help Center](https://www.linkedin.com/help/lms)
