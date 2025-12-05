import { Helmet } from 'react-helmet-async';

interface SEOHelmetProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  publishedDate?: string;
  modifiedDate?: string;
  authorName?: string;
  schemaType?: 'WebSite' | 'Article' | 'SoftwareApplication' | 'Organization';
  structuredData?: object | object[];
}

export function SEOHelmet({
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage = '/og-image.png',
  ogType = 'website',
  publishedDate,
  modifiedDate,
  authorName = 'Llumos',
  schemaType,
  structuredData
}: SEOHelmetProps) {
  const baseUrl = 'https://llumos.ai';
  const fullUrl = `${baseUrl}${canonicalPath}`;
  const fullTitle = `${title} | Llumos - AI Search Visibility Tracking`;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;

  // Generate schema based on schemaType prop
  const generateSchemaFromType = () => {
    if (!schemaType) return null;

    switch (schemaType) {
      case 'Article':
        return {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: title,
          description: description,
          image: fullOgImage,
          datePublished: publishedDate || new Date().toISOString(),
          dateModified: modifiedDate || publishedDate || new Date().toISOString(),
          author: {
            "@type": "Person",
            name: authorName,
            url: baseUrl
          },
          publisher: {
            "@type": "Organization",
            name: "Llumos",
            logo: {
              "@type": "ImageObject",
              url: `${baseUrl}/logo.png`,
              width: 200,
              height: 60
            }
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": fullUrl
          },
          url: fullUrl
        };

      case 'WebSite':
        return structuredDataGenerators.website();

      case 'Organization':
        return structuredDataGenerators.organization();

      case 'SoftwareApplication':
        return structuredDataGenerators.softwareApplication();

      default:
        return null;
    }
  };

  // Combine schema from schemaType with any additional structuredData
  const getAllStructuredData = () => {
    const schemaFromType = generateSchemaFromType();
    const dataArray: object[] = [];

    if (schemaFromType) {
      dataArray.push(schemaFromType);
    }

    if (structuredData) {
      if (Array.isArray(structuredData)) {
        dataArray.push(...structuredData);
      } else {
        dataArray.push(structuredData);
      }
    }

    return dataArray.length > 0 ? dataArray : null;
  };

  const allStructuredData = getAllStructuredData();

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
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Llumos" />
      
      {/* Article-specific Open Graph tags */}
      {ogType === 'article' && publishedDate && (
        <meta property="article:published_time" content={publishedDate} />
      )}
      {ogType === 'article' && modifiedDate && (
        <meta property="article:modified_time" content={modifiedDate} />
      )}
      {ogType === 'article' && authorName && (
        <meta property="article:author" content={authorName} />
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:site" content="@llumos_ai" />
      
      {/* Robots */}
      <meta name="robots" content="index, follow" />

      {/* JSON-LD Structured Data */}
      {allStructuredData && (
        <script type="application/ld+json">
          {JSON.stringify(allStructuredData)}
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
  }),

  blogPosting: (props: { 
    title: string; 
    description: string; 
    url: string; 
    image?: string;
    publishedDate: string; 
    modifiedDate?: string; 
    authorName?: string 
  }) => ({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: props.title,
    description: props.description,
    image: props.image || "https://llumos.ai/og-image.png",
    datePublished: props.publishedDate,
    dateModified: props.modifiedDate || props.publishedDate,
    author: {
      "@type": "Person",
      name: props.authorName || "Llumos",
      url: "https://llumos.ai"
    },
    publisher: {
      "@type": "Organization",
      name: "Llumos",
      logo: {
        "@type": "ImageObject",
        url: "https://llumos.ai/logo.png",
        width: 200,
        height: 60
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": props.url
    },
    url: props.url
  })
};
