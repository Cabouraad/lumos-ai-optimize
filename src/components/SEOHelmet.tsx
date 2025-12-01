import { Helmet } from 'react-helmet-async';

interface SEOHelmetProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
  structuredData?: object | object[];
}

export function SEOHelmet({
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage = '/og-image.png',
  structuredData
}: SEOHelmetProps) {
  const baseUrl = 'https://llumos.ai';
  const fullUrl = `${baseUrl}${canonicalPath}`;
  const fullTitle = `${title} | Llumos - AI Search Visibility Tracking`;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Llumos" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:site" content="@llumos_ai" />
      
      {/* Robots */}
      <meta name="robots" content="index, follow" />

      {/* JSON-LD Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(structuredData) ? structuredData : [structuredData])}
        </script>
      )}
    </Helmet>
  );
}

// Pre-built structured data generators
export const structuredDataGenerators = {
  organization: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Llumos",
    url: "https://llumos.ai",
    logo: "https://llumos.ai/logo.png",
    description: "Track and improve your brand's visibility on AI-powered search engines like ChatGPT, Gemini, and Perplexity",
    sameAs: [
      "https://twitter.com/llumos_ai"
    ]
  }),

  website: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Llumos",
    url: "https://llumos.ai",
    description: "AI Search Visibility Tracking Platform",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://llumos.ai/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }),

  softwareApplication: () => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Llumos",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "39",
      highPrice: "250",
      priceCurrency: "USD",
      offerCount: "3"
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "50"
    }
  }),

  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  }),

  videoObject: (props: { name: string; description: string; thumbnailUrl: string; uploadDate: string; embedUrl: string }) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: props.name,
    description: props.description,
    thumbnailUrl: props.thumbnailUrl,
    uploadDate: props.uploadDate,
    embedUrl: props.embedUrl,
    publisher: {
      "@type": "Organization",
      name: "Llumos",
      logo: {
        "@type": "ImageObject",
        url: "https://llumos.ai/logo.png"
      }
    }
  }),

  breadcrumb: (items: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `https://llumos.ai${item.url}`
    }))
  })
};
