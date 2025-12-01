import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Search, 
  Target, 
  ArrowRight,
  BarChart3,
  AlertTriangle,
  Eye,
  RefreshCw,
  TrendingUp,
  Zap,
  CheckCircle
} from 'lucide-react';
import brandVisibilityHero from '@/assets/brand-visibility-hero.jpg';
import { Breadcrumb } from '@/components/Breadcrumb';

const BrandVisibility = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Brand Visibility Monitoring - Track Your AI Search Presence | Llumos</title>
        <meta name="description" content="Monitor your brand's visibility across AI search platforms like ChatGPT, Gemini, and Perplexity. Real-time tracking with visibility scoring and sentiment analysis." />
        <meta property="og:title" content="Brand Visibility Monitoring - Track Your AI Search Presence" />
        <meta property="og:description" content="Real-time brand tracking across all major AI platforms with visibility scoring and sentiment analysis." />
        <meta property="og:image" content={brandVisibilityHero} />
        <link rel="canonical" href="https://llumos.ai/features/brand-visibility" />
      </Helmet>

      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Llumos</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Button variant="outline" asChild>
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Breadcrumb */}
      <Breadcrumb 
        className="container mx-auto max-w-6xl" 
        items={[
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
          { name: 'Brand Visibility', path: '/features/brand-visibility' }
        ]}
      />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                Brand Visibility
                <span className="text-primary block">Monitoring</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Know exactly when, where, and how your brand appears in AI search results. Real-time monitoring across all major AI platforms with actionable insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/signup">Start Monitoring <ArrowRight className="ml-2 w-5 h-5" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/features">All Features</Link>
                </Button>
              </div>
            </div>
            <div>
              <img 
                src={brandVisibilityHero} 
                alt="Brand visibility monitoring dashboard showing analytics and tracking data"
                className="w-full h-auto rounded-lg shadow-lg"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Complete Brand Visibility Overview
            </h2>
            <p className="text-xl text-muted-foreground">
              Get a 360-degree view of your brand's presence in AI search results
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Eye className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Multi-Platform Coverage</h3>
              <p className="text-muted-foreground">
                Monitor ChatGPT, Gemini, Perplexity, and other major AI platforms from one unified dashboard. See where your brand appears and where it doesn't.
              </p>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Visibility Scoring</h3>
              <p className="text-muted-foreground">
                Quantified metrics that track your brand's visibility over time. Understand your performance with clear, actionable data points.
              </p>
            </Card>
            
            <Card className="p-6">
              <AlertTriangle className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Sentiment Analysis</h3>
              <p className="text-muted-foreground">
                Understand how AI models perceive and present your brand. Identify potential reputation issues before they impact your business.
              </p>
            </Card>
            
            <Card className="p-6">
              <RefreshCw className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Automated Tracking</h3>
              <p className="text-muted-foreground">
                Daily automated scans with instant alerts for significant changes. Never miss an important shift in your brand's AI search presence.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Brand Visibility Monitoring Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Our systematic approach to tracking your brand across AI platforms
            </p>
          </div>
          
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Setup & Configuration</h3>
                <p className="text-muted-foreground">
                  Define your brand terms, competitors, and industry keywords. Our system learns your brand context.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Quick 5-minute setup process guides you through brand configuration and competitor identification.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Continuous Monitoring</h3>
                <p className="text-muted-foreground">
                  Daily scans across all major AI platforms using thousands of relevant search queries.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Our system runs 24/7, performing comprehensive scans and tracking brand mentions across ChatGPT, Gemini, and Perplexity.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Analysis & Insights</h3>
                <p className="text-muted-foreground">
                  Advanced analytics provide visibility scores, sentiment analysis, and trend identification.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Machine learning algorithms analyze brand mentions, context, and sentiment to provide actionable insights.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visibility Impact */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Brand Visibility Helps You Get Found in AI Search
            </h2>
            <p className="text-xl text-muted-foreground">
              Understanding your current visibility is the first step to improving your AI search presence
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">The Challenge</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Brands are invisible in 73% of relevant AI search queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Most businesses don't know when they're mentioned negatively</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Competitors dominate AI responses without your knowledge</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">The Solution</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Track visibility across all major AI platforms daily</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Monitor sentiment and brand perception in real-time</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Identify gaps where competitors appear but you don't</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Get alerts for significant changes in your visibility</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Card className="p-8 bg-background">
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Average 47% Improvement in AI Search Visibility
              </h3>
              <p className="text-muted-foreground mb-6">
                Businesses using our brand visibility monitoring see significant improvements in their AI search presence within 90 days.
              </p>
              <Button asChild>
                <Link to="/signup">Start Your Free Trial</Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Key Capabilities
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to monitor and improve your brand's AI search visibility
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <Target className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Brand Mention Tracking</h3>
              <p className="text-muted-foreground mb-4">
                Comprehensive tracking of all brand mentions across AI platforms with context analysis.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Direct brand name mentions</li>
                <li>• Product and service references</li>
                <li>• Misspellings and variations</li>
                <li>• Context and positioning analysis</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Visibility Metrics</h3>
              <p className="text-muted-foreground mb-4">
                Quantified scoring system to track your brand's visibility performance over time.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Overall visibility score</li>
                <li>• Platform-specific performance</li>
                <li>• Trend analysis and forecasting</li>
                <li>• Competitive benchmarking</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <Zap className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Real-time Alerts</h3>
              <p className="text-muted-foreground mb-4">
                Instant notifications for significant changes in your brand's AI search presence.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Visibility spike or drop alerts</li>
                <li>• New negative sentiment detection</li>
                <li>• Competitor mention changes</li>
                <li>• Customizable alert thresholds</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Start Monitoring Your Brand Today
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get complete visibility into your brand's AI search presence with our 14-day free trial.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/signup">Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            14-day free trial • No credit card required • Full feature access
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t bg-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Search className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Llumos</span>
          </div>
          <p className="text-muted-foreground mb-4">
            AI Search Optimization. Simplified.
          </p>
          <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/signin" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BrandVisibility;