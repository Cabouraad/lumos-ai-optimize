import { Link } from 'react-router-dom';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';

interface SitemapSection {
  title: string;
  links: Array<{ name: string; path: string; description?: string }>;
}

const sitemapData: SitemapSection[] = [
  {
    title: 'Main Pages',
    links: [
      { name: 'Home', path: '/', description: 'AI Search Visibility Platform' },
      { name: 'Pricing', path: '/pricing', description: 'Plans and pricing options' },
      { name: 'Features', path: '/features', description: 'Platform capabilities overview' },
      { name: 'Demo', path: '/demo', description: 'Watch the platform walkthrough' },
      { name: 'Compare vs Enterprise', path: '/vs-competitors', description: 'See why marketers choose Llumos' },
    ],
  },
  {
    title: 'Features',
    links: [
      { name: 'Brand Visibility Tracking', path: '/features/brand-visibility', description: 'Monitor AI mentions' },
      { name: 'Competitive Analysis', path: '/features/competitive-analysis', description: 'Track competitor presence' },
      { name: 'Actionable Recommendations', path: '/features/actionable-recommendations', description: 'Get optimization insights' },
      { name: 'Citation Analysis', path: '/features/citation-analysis', description: 'Analyze AI citations' },
      { name: 'LLMs.txt', path: '/features/llms-txt', description: 'AI-friendly content format' },
      { name: 'Content Studio', path: '/features/content-studio', description: 'Create optimized content' },
      { name: 'Tier Comparison', path: '/features/tier-comparison', description: 'Compare plan features' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Blog & Guides', path: '/resources', description: 'Expert insights and tutorials' },
      { name: 'Free Visibility Checker', path: '/free-checker', description: 'Check your AI visibility score' },
    ],
  },
  {
    title: 'Plans',
    links: [
      { name: 'Starter Plan', path: '/plans/starter', description: 'For small businesses' },
      { name: 'Growth Plan', path: '/plans/growth', description: 'For growing teams' },
      { name: 'Pro Plan', path: '/plans/pro', description: 'For enterprises' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', path: '/privacy', description: 'How we handle your data' },
      { name: 'Terms of Service', path: '/terms', description: 'Usage terms and conditions' },
    ],
  },
  {
    title: 'Account',
    links: [
      { name: 'Sign In', path: '/signin', description: 'Access your account' },
      { name: 'Sign Up', path: '/signup', description: 'Create a new account' },
    ],
  },
];

const Sitemap = () => {
  return (
    <>
      <SEOHelmet
        title="Sitemap"
        description="Browse all pages on Llumos - AI Search Visibility Tracking Platform. Find features, resources, pricing, and more."
        keywords="sitemap, llumos pages, navigation, site map"
        canonicalPath="/sitemap"
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Search className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">Llumos</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">Resources</Link>
              <Button variant="outline" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Sitemap
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Browse all pages and resources available on Llumos
            </p>
          </div>

          {/* Sitemap Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sitemapData.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                  {section.title}
                </h2>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.path}>
                      <Link
                        to={link.path}
                        className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <div>
                          <span className="text-foreground group-hover:text-primary transition-colors font-medium">
                            {link.name}
                          </span>
                          {link.description && (
                            <p className="text-sm text-muted-foreground">
                              {link.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* XML Sitemap Note */}
          <div className="mt-16 p-6 bg-muted/30 rounded-lg text-center">
            <p className="text-muted-foreground">
              Looking for the XML sitemap for search engines?{' '}
              <a 
                href="/sitemap.xml" 
                className="text-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                View sitemap.xml
              </a>
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Sitemap;
