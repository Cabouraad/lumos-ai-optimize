import { Helmet } from 'react-helmet-async';

// Pricing configuration - can be imported from a central config
export const LLUMOS_PRICING = {
  starter: {
    price: 39,
    currency: 'USD',
    period: 'month',
  },
  growth: {
    price: 99,
    currency: 'USD',
    period: 'month',
  },
  agency: {
    price: 149,
    currency: 'USD',
    period: 'month',
  },
};

interface SoftwareApplicationSchemaProps {
  price?: number;
  currency?: string;
  priceValidUntil?: string;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
}

/**
 * SoftwareApplication Schema Component
 * 
 * Generates JSON-LD structured data for SoftwareApplication schema.
 * This helps Google understand Llumos as a software product and can enable:
 * - Rich snippets with pricing in search results
 * - Entity recognition (Llumos as a Tool/Software)
 * - Star ratings display (when aggregateRating is provided)
 * 
 * @see https://schema.org/SoftwareApplication
 */
export const SoftwareApplicationSchema = ({
  price = LLUMOS_PRICING.starter.price,
  currency = LLUMOS_PRICING.starter.currency,
  priceValidUntil = '2025-12-31',
  aggregateRating,
}: SoftwareApplicationSchemaProps = {}) => {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Llumos",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Cloud/Web",
    "description": "AI Search Visibility & GEO Tracking Platform. Track your brand visibility across AI-powered search engines like ChatGPT, Claude, Perplexity, and Google AI Overviews.",
    "url": "https://llumos.ai",
    "image": "https://llumos.ai/og-home.png",
    "screenshot": "https://llumos.ai/screenshot-dashboard.png",
    "author": {
      "@type": "Organization",
      "name": "Llumos",
      "url": "https://llumos.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Llumos",
      "url": "https://llumos.ai",
      "logo": {
        "@type": "ImageObject",
        "url": "https://llumos.ai/logo.png"
      }
    },
    "offers": {
      "@type": "Offer",
      "price": price.toFixed(2),
      "priceCurrency": currency,
      "priceValidUntil": priceValidUntil,
      "availability": "https://schema.org/InStock",
      "url": "https://llumos.ai/pricing"
    },
    "featureList": [
      "AI Search Visibility Tracking",
      "ChatGPT Brand Monitoring",
      "Perplexity Visibility Analytics",
      "Google AI Overviews Tracking",
      "Competitor Analysis",
      "Citation Analytics",
      "White-Label Reports",
      "GEO Optimization Recommendations"
    ],
    "applicationSubCategory": "Marketing Software",
    "releaseNotes": "Track and optimize your brand visibility across all major AI search platforms.",
    "softwareVersion": "2.0",
    "datePublished": "2024-01-01",
    "dateModified": new Date().toISOString().split('T')[0],
  };

  // Add aggregate rating if provided
  if (aggregateRating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": aggregateRating.ratingValue,
      "reviewCount": aggregateRating.reviewCount,
      "bestRating": aggregateRating.bestRating || 5,
      "worstRating": aggregateRating.worstRating || 1,
    };
  }

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

/**
 * Organization Schema Component
 * Helps establish Llumos as a recognized entity
 */
export const OrganizationSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Llumos",
    "url": "https://llumos.ai",
    "logo": "https://llumos.ai/logo.png",
    "description": "AI Search Visibility & GEO Tracking Platform",
    "foundingDate": "2024",
    "sameAs": [
      "https://twitter.com/llumos_ai",
      "https://linkedin.com/company/llumos"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Support",
      "email": "support@llumos.ai"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

/**
 * WebSite Schema Component
 * Helps with sitelinks search box in Google
 */
export const WebSiteSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Llumos",
    "url": "https://llumos.ai",
    "description": "Track your brand visibility across AI-powered search engines",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://llumos.ai/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

/**
 * Combined Landing Page Schema
 * Use this on the main landing page for comprehensive SEO
 */
export const LandingPageSchema = () => {
  return (
    <>
      <SoftwareApplicationSchema 
        price={LLUMOS_PRICING.starter.price}
        currency={LLUMOS_PRICING.starter.currency}
        priceValidUntil="2025-12-31"
        // Uncomment when you have verified reviews:
        // aggregateRating={{
        //   ratingValue: 4.8,
        //   reviewCount: 127,
        // }}
      />
      <OrganizationSchema />
      <WebSiteSchema />
    </>
  );
};

export default SoftwareApplicationSchema;
