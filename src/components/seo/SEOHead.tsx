import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

const BASE_URL = 'https://llumos.ai';

/**
 * SEOHead - A streamlined component for AI crawler-friendly metadata
 * Use this for marketing pages that need optimal SEO/AEO performance
 */
export function SEOHead({ 
  title, 
  description, 
  canonicalUrl = '/', 
  ogImage = '/og-home.png' 
}: SEOHeadProps) {
  const fullUrl = `${BASE_URL}${canonicalUrl}`;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
  const fullTitle = title.includes('Llumos') ? title : `${title} | Llumos`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Llumos" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:site" content="@llumos_ai" />
      
      {/* Robots */}
      <meta name="robots" content="index, follow" />
    </Helmet>
  );
}

export default SEOHead;
