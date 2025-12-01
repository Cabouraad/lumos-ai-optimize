import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const routeNames: Record<string, string> = {
  '': 'Home',
  'features': 'Features',
  'pricing': 'Pricing',
  'demo': 'Demo',
  'signin': 'Sign In',
  'signup': 'Sign Up',
  'terms': 'Terms of Service',
  'privacy': 'Privacy Policy',
  'brand-visibility': 'Brand Visibility',
  'competitive-analysis': 'Competitive Analysis',
  'actionable-recommendations': 'Actionable Recommendations',
  'dashboard': 'Dashboard',
  'prompts': 'Prompts',
  'reports': 'Reports',
};

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if items not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ name: 'Home', path: '/' }];
    
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath += `/${segment}`;
      crumbs.push({
        name: routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        path: currentPath,
      });
    }
    
    return crumbs;
  })();

  // Don't render on homepage
  if (location.pathname === '/' || breadcrumbItems.length <= 1) {
    return null;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://llumos.ai${item.path}`
    }))
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <nav aria-label="Breadcrumb" className={`py-3 px-4 ${className}`}>
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            
            return (
              <li key={item.path} className="flex items-center gap-2">
                {index === 0 && (
                  <Home className="w-4 h-4" aria-hidden="true" />
                )}
                {isLast ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link 
                      to={item.path}
                      className="hover:text-foreground transition-colors"
                    >
                      {item.name}
                    </Link>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
