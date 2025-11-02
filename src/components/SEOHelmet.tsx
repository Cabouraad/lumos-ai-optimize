import { Helmet } from 'react-helmet-async';

interface SEOHelmetProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
}

export function SEOHelmet({
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage = '/lovable-uploads/a3631033-2657-4c97-8fd8-079913859ab0.png'
}: SEOHelmetProps) {
  const baseUrl = 'https://llumos.ai';
  const fullUrl = `${baseUrl}${canonicalPath}`;
  const fullTitle = `${title} | Llumos - AI Search Visibility Tracking`;

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
      <meta property="og:image" content={`${baseUrl}${ogImage}`} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${baseUrl}${ogImage}`} />
      
      {/* Robots */}
      <meta name="robots" content="index, follow" />
    </Helmet>
  );
}
