import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { CheckCircle, Search, Target, TrendingUp, Zap, Shield, Clock, ArrowRight, Star, Quote, BarChart3, Users, DollarSign } from 'lucide-react';
import { ROICalculator } from '@/components/landing/ROICalculator';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { LlumosScoreChecker } from '@/components/home/LlumosScoreChecker';
import { ExitIntentPopup } from '@/components/home/ExitIntentPopup';
import { LinkedInPixel } from '@/components/tracking/LinkedInPixel';
import { GoogleAnalytics } from '@/components/tracking/GoogleAnalytics';
import { ProofSection } from '@/components/landing/ProofSection';
import { useAnalytics } from '@/hooks/useAnalytics';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';

const Index = () => {
  const { user, loading, orgData, orgStatus, ready, isChecking } = useAuth();
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { trackCtaClick } = useAnalytics();

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect to dashboard if we confirmed the user has an org
  if (user && orgData && orgStatus === 'success') {
    return <Navigate to="/dashboard" replace />;
  }

  // Only redirect to onboarding if we confirmed there's no org AND we're not still checking
  if (user && orgStatus === 'not_found' && !isChecking) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <>
      <SEOHelmet
        title="AI Search Visibility Tracking for Modern Brands"
        description="Monitor and grow your brand's visibility on ChatGPT, Gemini, and Perplexity. Track AI search mentions, analyze competitors, and get actionable recommendations to improve your AI search presence."
        keywords="AI search visibility, ChatGPT tracking, Perplexity monitoring, AI SEO, brand visibility tracking, AI search optimization, Gemini search"
        canonicalPath="/"
      />
      <div className="min-h-screen bg-gradient-bg">
        {/* Exit Intent Popup */}
        <ExitIntentPopup />
      
      {/* Sticky CTA Bar */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary shadow-elevated z-50 animate-fade-in">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-primary-foreground font-semibold">Start tracking your AI visibility today</span>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/signup">Start Free Trial <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Llumos</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">Resources</Link>
            <Button variant="outline" asChild>
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild className="shadow-glow">
              <Link to="/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center relative overflow-hidden">
        <div className="container mx-auto max-w-5xl relative z-10">
          <header>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <Badge className="text-sm py-1 px-4 shadow-soft">
              <Star className="w-3 h-3 mr-1 inline fill-current" />
              Trusted by B2B Marketing Teams and Agencies
            </Badge>
            <Badge variant="secondary" className="text-sm py-1 px-4 shadow-soft">
              🔥 New: Google AI Overviews Supported
            </Badge>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in">
            AI is rewriting search.
            <span className="text-primary block mt-2 bg-gradient-primary bg-clip-text text-transparent">Is your brand being mentioned?</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Monitor and grow your brand's visibility on ChatGPT, Gemini, and Perplexity — without breaking your budget.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button 
              size="lg" 
              className="text-lg px-10 py-7 shadow-glow hover-lift"
              onClick={() => {
                trackCtaClick('hero_check_score');
                document.getElementById('proof-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Check Your Llumos Score Free →
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              asChild 
              className="text-lg px-10 py-7"
              onClick={() => trackCtaClick('hero_start_trial')}
            >
              <Link to="/signup">Start 7-Day Free Trial</Link>
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              7-day free trial
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              Setup in 5 minutes
            </span>
          </div>

          {/* Social Proof Stats */}
          <div className="mt-12 pt-8 border-t border-border/50">
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">47%</div>
                <div className="text-muted-foreground">Avg. Visibility Increase</div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">10M+</div>
                <div className="text-muted-foreground">AI Queries Tracked</div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">4.9★</div>
                <div className="text-muted-foreground">Customer Rating</div>
              </div>
            </div>
          </div>
          </header>
        </div>
      </section>

      {/* Score Checker Section */}
      <LlumosScoreChecker />

      {/* Proof Section */}
      <div id="proof-section">
        <ProofSection />
      </div>

      {/* Stats Section */}
      <section className="py-12 px-4 bg-card/50 backdrop-blur border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-2">
              🚀 Most Popular for B2B SaaS Companies
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
            <div className="animate-fade-in">
              <div className="text-4xl font-bold text-primary mb-2">10M+</div>
              <div className="text-sm text-muted-foreground">AI Queries Tracked</div>
            </div>
            <div className="animate-fade-in" style={{animationDelay: '0.2s'}}>
              <div className="text-4xl font-bold text-primary mb-2">47%</div>
              <div className="text-sm text-muted-foreground">Avg. Visibility Increase</div>
            </div>
            <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime Guarantee</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Traditional SEO Tools vs Llumos AI Search Tracking
          </h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <Card className="p-8 bg-destructive/5 border-destructive/20 hover-lift">
              <h3 className="text-xl font-semibold text-foreground mb-4">Enterprise Alternatives</h3>
              <ul className="text-left space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>$500-2000+ per month for basic features</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Overwhelming dashboards with 100+ metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Weeks of onboarding and training required</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Generic insights buried in complexity</span>
                </li>
              </ul>
            </Card>
            <Card className="p-8 bg-primary/5 border-primary/20 hover-lift">
              <h3 className="text-xl font-semibold text-foreground mb-4">Llumos</h3>
              <ul className="text-left space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Starting at $39/month - 80% cost savings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Clean, focused dashboard with what matters</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Up and running in under 5 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Actionable insights, zero complexity</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Comparison Table */}
      <ComparisonTable />

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4">Core Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              AI Search Visibility Tools for Modern Brands
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three core features that actually matter for brand visibility tracking on AI platforms.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Brand Visibility Monitoring</h3>
              <p className="text-muted-foreground">
                Track how your brand appears across AI platforms like ChatGPT, Gemini, Perplexity, and Google AI Overviews with clear, actionable metrics.
              </p>
            </Card>
            
            <Card className="p-8 text-center hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Competitive Intelligence</h3>
              <p className="text-muted-foreground">
                See which competitors are winning in AI search results and identify opportunities to increase your brand visibility.
              </p>
            </Card>
            
            <Card className="p-8 text-center hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Smart Recommendations</h3>
              <p className="text-muted-foreground">
                Get specific, actionable recommendations to improve your brand's visibility and presence in AI-powered search results.
              </p>
            </Card>
          </div>
        </div>
      </section>


      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simplicity is Our Superpower
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="hover-lift">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Enterprise-Grade Security</h3>
              <p className="text-muted-foreground text-sm">Your data is protected with bank-level security standards.</p>
            </div>
            
            <div className="hover-lift">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">5-Minute Setup</h3>
              <p className="text-muted-foreground text-sm">From signup to insights in less time than it takes to make coffee.</p>
            </div>
            
            <div className="hover-lift">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Measurable ROI</h3>
              <p className="text-muted-foreground text-sm">Track the direct impact on your brand's AI search performance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="pricing" className="py-20 px-4 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Dominate AI Search Results?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Optimize your brand for the AI search era
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button size="lg" variant="secondary" asChild className="text-lg px-10 py-7 shadow-elevated">
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-10 py-7 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
          <p className="text-sm opacity-80">
            ✓ Full access for 7 days  ✓ Payment method required  ✓ Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Google Analytics - Add your GA4 Measurement ID here */}
      <GoogleAnalytics />
      
      {/* LinkedIn Conversion Tracking */}
      <LinkedInPixel />
    </div>
    </>
  );
};

export default Index;
