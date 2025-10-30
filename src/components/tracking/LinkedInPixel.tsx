import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

interface LinkedInPixelProps {
  partnerId?: string;
}

export function LinkedInPixel({ partnerId }: LinkedInPixelProps) {
  useEffect(() => {
    // Only load if partnerId is provided
    if (!partnerId) return;

    // Initialize LinkedIn Insight Tag
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.innerHTML = `
      _linkedin_partner_id = "${partnerId}";
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
      window._linkedin_data_partner_ids.push(_linkedin_partner_id);
    `;
    document.head.appendChild(script);

    // Load LinkedIn tracking script
    const trackingScript = document.createElement('script');
    trackingScript.type = 'text/javascript';
    trackingScript.async = true;
    trackingScript.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
    document.head.appendChild(trackingScript);

    return () => {
      // Cleanup on unmount
      document.head.removeChild(script);
      document.head.removeChild(trackingScript);
    };
  }, [partnerId]);

  // Don't render anything if no partnerId
  if (!partnerId) return null;

  return (
    <Helmet>
      <noscript>
        {`<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />`}
      </noscript>
    </Helmet>
  );
}
