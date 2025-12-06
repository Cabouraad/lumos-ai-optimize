import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  MessageSquare, 
  Target,
  Search,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { Footer } from '@/components/Footer';

// Industry configuration type
interface IndustryConfig {
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  caseStudyMetric: string;
  heroImage?: string;
}

// Predefined industry configurations
const industries: Record<string, IndustryConfig> = {
  'saas': {
    name: 'SaaS',
    slug: 'saas',
    description: 'Software as a Service companies competing for AI visibility',
    keywords: ['best SaaS tools', 'top software solutions', 'SaaS alternatives', 'cloud software comparison', 'enterprise SaaS'],
    caseStudyMetric: '40%',
  },
  'ecommerce': {
    name: 'E-commerce',
    slug: 'ecommerce',
    description: 'Online retailers and marketplaces optimizing for AI recommendations',
    keywords: ['best online stores', 'top e-commerce platforms', 'where to buy', 'product recommendations', 'shopping comparison'],
    caseStudyMetric: '55%',
  },
  'fintech': {
    name: 'Fintech',
    slug: 'fintech',
    description: 'Financial technology companies building trust in AI search',
    keywords: ['best fintech apps', 'top payment solutions', 'financial software', 'banking alternatives', 'investment platforms'],
    caseStudyMetric: '35%',
  },
  'healthcare': {
    name: 'Healthcare',
    slug: 'healthcare',
    description: 'Healthcare providers and health tech companies',
    keywords: ['best healthcare providers', 'top health apps', 'medical solutions', 'telehealth platforms', 'healthcare technology'],
    caseStudyMetric: '45%',
  },
  'legal': {
    name: 'Legal',
    slug: 'legal',
    description: 'Law firms and legal tech platforms',
    keywords: ['best law firms', 'legal services near me', 'top attorneys', 'legal tech solutions', 'contract management'],
    caseStudyMetric: '30%',
  },
  'real-estate': {
    name: 'Real Estate',
    slug: 'real-estate',
    description: 'Real estate agencies and property tech platforms',
    keywords: ['best real estate agents', 'top property listings', 'home buying platforms', 'real estate comparison', 'property management'],
    caseStudyMetric: '50%',
  },
};

// Default fallback industry
const defaultIndustry: IndustryConfig = {
  name: 'Your Industry',
  slug: 'industry',
  description: 'Companies optimizing for AI search visibility',
  keywords: ['industry leaders', 'top solutions', 'best providers', 'comparison tools', 'alternatives'],
  caseStudyMetric: '40%',
};

// Generate BreadcrumbList schema
const generateBreadcrumbSchema = (industryName: string, industrySlug: string) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://llumos.ai"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Industries",
      "item": "https://llumos.ai/industries"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": industryName,
      "item": `https://llumos.ai/industries/${industrySlug}`
    }
  ]
});

// Breadcrumb component
const Breadcrumbs = ({ industryName, industrySlug }: { industryName: string; industrySlug: string }) => (
  <nav aria-label="Breadcrumb" className="mb-8">
    <ol className="flex items-center gap-2 text-sm text-muted-foreground">
      <li>
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
      </li>
      <ChevronRight className="h-4 w-4" />
      <li>
        <Link to="/industries" className="hover:text-foreground transition-colors">
          Industries
        </Link>
      </li>
      <ChevronRight className="h-4 w-4" />
      <li>
        <span className="text-foreground font-medium">{industryName}</span>
      </li>
    </ol>
  </nav>
);

interface DynamicIndustryLandingPageProps {
  industryOverride?: string;
}

const DynamicIndustryLandingPage = ({ industryOverride }: DynamicIndustryLandingPageProps) => {
  const { industry: industryParam } = useParams<{ industry: string }>();
  const industrySlug = industryOverride || industryParam || 'saas';
  const industry = industries[industrySlug] || { ...defaultIndustry, name: industrySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), slug: industrySlug };

  const pageTitle = `AI Search Visibility & GEO for ${industry.name} Companies | Llumos`;
  const metaDescription = `Don't let your ${industry.name} brand disappear in the AI era. Llumos helps ${industry.name} companies track and optimize their presence on Perplexity and Gemini.`;
  const canonicalUrl = `https://llumos.ai/industries/${industry.slug}`;
  const keywords = `AI SEO for ${industry.name}, ${industry.name} brand reputation management, ChatGPT marketing for ${industry.name}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        
        {/* BreadcrumbList Schema */}
        <script type="application/ld+json">
          {JSON.stringify(generateBreadcrumbSchema(industry.name, industry.slug))}
        </script>
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Llumos</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
            <Button asChild>
              <Link to="/signup">Start Free Trial</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="min-h-screen bg-background">
        
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <Breadcrumbs industryName={industry.name} industrySlug={industry.slug} />
            
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Target className="h-4 w-4" />
                {industry.name} Industry
              </div>
              
              {/* Dynamic H1 with Industry Name */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Dominating AI Search Results for{' '}
                <span className="text-primary">{industry.name}</span> Brands
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                {industry.description}. Track how AI engines like ChatGPT and Perplexity recommend your brand—and your competitors.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/demo">See How It Works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">
                  Is ChatGPT Recommending Your {industry.name} Competitors?
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  When potential customers ask AI assistants for {industry.name.toLowerCase()} recommendations, 
                  is your brand part of the conversation? Or are your competitors getting all the mentions?
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Users ask: "What's the best {industry.name.toLowerCase()} solution?"</p>
                      <p className="text-muted-foreground text-sm">AI recommends your competitor instead of you</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <Search className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">You're invisible in AI-generated responses</p>
                      <p className="text-muted-foreground text-sm">Losing potential customers before they even reach your site</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">No visibility into AI search performance</p>
                      <p className="text-muted-foreground text-sm">Traditional analytics don't track AI recommendations</p>
                    </div>
                  </li>
                </ul>
              </div>
              
              {/* Placeholder Chat Interface Image */}
              <div className="relative">
                <Card className="p-6 bg-background border-border/50 shadow-lg">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">
                          What are the best {industry.name.toLowerCase()} companies to work with?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-sm text-foreground">
                          Here are some top {industry.name.toLowerCase()} companies...
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">1. <span className="text-destructive font-medium">Competitor A</span></p>
                          <p className="text-sm text-muted-foreground">2. <span className="text-destructive font-medium">Competitor B</span></p>
                          <p className="text-sm text-muted-foreground">3. <span className="text-destructive font-medium">Competitor C</span></p>
                          <p className="text-sm text-muted-foreground/50 italic">Your brand is missing...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="absolute -bottom-4 -right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
                  You're not being recommended!
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Case Study Block */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-700 px-3 py-1 rounded-full text-xs font-medium mb-4">
                    Case Study
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    How a {industry.name} Company Increased AI Traffic by {industry.caseStudyMetric}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Learn how a leading {industry.name.toLowerCase()} brand used Llumos to identify visibility gaps, 
                    optimize their content for AI engines, and dramatically increase their share of AI-driven recommendations.
                  </p>
                  <Button variant="outline" className="border-green-500/30 hover:bg-green-500/10">
                    Read the Full Case Study
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Top AI Keywords Section */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Top AI Keywords for {industry.name}
              </h2>
              <p className="text-muted-foreground">
                These are the questions users are asking AI assistants about {industry.name.toLowerCase()}. 
                Is your brand showing up in the answers?
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <Card className="p-6 bg-background">
                <ul className="space-y-4">
                  {industry.keywords.map((keyword, index) => (
                    <li key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">"{keyword}"</p>
                        <p className="text-sm text-muted-foreground">High AI search volume</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${90 - index * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{90 - index * 10}%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 text-center">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Ready to Dominate AI Search in {industry.name}?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Start tracking your {industry.name.toLowerCase()} brand's AI visibility today. 
                See exactly how ChatGPT, Perplexity, and Gemini recommend you vs. your competitors.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Start Your Free 7-Day Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                No credit card required • Setup in under 5 minutes
              </p>
            </Card>
          </div>
        </section>

      </div>

      <Footer />
    </>
  );
};

export default DynamicIndustryLandingPage;
