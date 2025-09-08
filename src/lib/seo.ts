interface MetaTagsProps {
  title: string;
  description: string;
  keywords?: string;
  author?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  publishedTime?: string;
  modifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];
}

export function generateMetaTags({
  title,
  description,
  keywords,
  author = "Llumos",
  canonicalUrl,
  ogImage = "/og-image.png",
  ogType = "website",
  twitterCard = "summary_large_image",
  publishedTime,
  modifiedTime,
  articleSection,
  articleTags = []
}: MetaTagsProps) {
  const baseUrl = "https://llumos.ai";
  const fullCanonicalUrl = canonicalUrl ? `${baseUrl}${canonicalUrl}` : baseUrl;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;

  return {
    title: `${title} | Llumos - AI Search Visibility Tracking`,
    meta: [
      { name: "description", content: description },
      { name: "keywords", content: keywords || "AI search, brand visibility, ChatGPT, Claude, Perplexity, AI SEO, search optimization" },
      { name: "author", content: author },
      { name: "robots", content: "index, follow" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      
      // Open Graph
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: ogType },
      { property: "og:url", content: fullCanonicalUrl },
      { property: "og:image", content: fullOgImage },
      { property: "og:site_name", content: "Llumos" },
      
      // Twitter Card
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: fullOgImage },
      { name: "twitter:site", content: "@llumos_ai" },
      
      // Article specific
      ...(publishedTime ? [{ property: "article:published_time", content: publishedTime }] : []),
      ...(modifiedTime ? [{ property: "article:modified_time", content: modifiedTime }] : []),
      ...(articleSection ? [{ property: "article:section", content: articleSection }] : []),
      ...articleTags.map(tag => ({ property: "article:tag", content: tag })),
      
      // Canonical
      ...(canonicalUrl ? [{ rel: "canonical", href: fullCanonicalUrl }] : [])
    ]
  };
}

export function generateStructuredData(type: 'Article' | 'Organization' | 'WebSite', data: any) {
  const baseStructuredData = {
    "@context": "https://schema.org",
    "@type": type
  };

  switch (type) {
    case 'Article':
      return {
        ...baseStructuredData,
        headline: data.headline,
        description: data.description,
        image: data.image,
        author: {
          "@type": "Organization",
          name: "Llumos"
        },
        publisher: {
          "@type": "Organization",
          name: "Llumos",
          logo: {
            "@type": "ImageObject",
            url: "https://llumos.ai/logo.png"
          }
        },
        datePublished: data.datePublished,
        dateModified: data.dateModified,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": data.url
        }
      };
    
    case 'Organization':
      return {
        ...baseStructuredData,
        name: "Llumos",
        url: "https://llumos.ai",
        logo: "https://llumos.ai/logo.png",
        description: "The simplest way to track and increase your brand visibility on AI-powered search engines",
        sameAs: [
          "https://twitter.com/llumos_ai"
        ]
      };
    
    case 'WebSite':
      return {
        ...baseStructuredData,
        name: "Llumos",
        url: "https://llumos.ai",
        description: "Track your brand visibility across AI-powered search engines like ChatGPT, Claude, and Perplexity",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://llumos.ai/search?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      };
    
    default:
      return baseStructuredData;
  }
}

export function createBreadcrumbStructuredData(items: Array<{name: string, url: string}>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `https://llumos.ai${item.url}`
    }))
  };
}