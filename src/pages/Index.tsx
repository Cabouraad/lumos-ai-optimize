import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { CheckCircle, Search, Target, TrendingUp, Zap, Shield, Clock, ArrowRight } from 'lucide-react';

const Index = () => {
  const { user, loading, orgData } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && orgData) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user && !orgData) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="outline" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Help Local Businesses Get Found on
            <span className="text-primary block">AI Search Results</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Optimize your local business for AI-powered search engines like ChatGPT, Claude, and Perplexity. Monitor, analyze, and improve your visibility in localized AI search results that drive real customers to your door.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/auth">Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">No credit card required • 14-day free trial</p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            The Problem with "Everything" Platforms
          </h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <Card className="p-8 bg-destructive/5 border-destructive/20">
              <h3 className="text-xl font-semibold text-foreground mb-4">Other Platforms</h3>
              <ul className="text-left space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>100+ features you'll never use</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Generic global insights with no local focus</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Miss local search opportunities entirely</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <span>Months of setup and training required</span>
                </li>
              </ul>
            </Card>
            <Card className="p-8 bg-primary/5 border-primary/20">
              <h3 className="text-xl font-semibold text-foreground mb-4">Llumos</h3>
              <ul className="text-left space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Localized AI search optimization that drives foot traffic</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Track local competitors in AI search results</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>City and region-specific visibility insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Up and running in under 5 minutes</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Just What You Need. Nothing You Don't.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We've identified the 3 core capabilities that actually drive results in AI search optimization.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover:shadow-lg transition-shadow">
              <Target className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Local AI Search Monitoring</h3>
              <p className="text-muted-foreground">
                Track how your local business appears in AI search results for location-based queries in your city and region.
              </p>
            </Card>
            
            <Card className="p-8 text-center hover:shadow-lg transition-shadow">
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Local Competitive Analysis</h3>
              <p className="text-muted-foreground">
                See which local competitors are winning in AI search results and discover opportunities to outrank them.
              </p>
            </Card>
            
            <Card className="p-8 text-center hover:shadow-lg transition-shadow">
              <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Location-Based Optimization</h3>
              <p className="text-muted-foreground">
                Get specific recommendations to improve your visibility in local AI searches that drive customers to your business.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Built for Efficiency, Not Complexity
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Enterprise-Grade Security</h3>
              <p className="text-muted-foreground text-sm">Your data is protected with bank-level security standards.</p>
            </div>
            
            <div>
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">5-Minute Setup</h3>
              <p className="text-muted-foreground text-sm">From signup to insights in less time than it takes to make coffee.</p>
            </div>
            
            <div>
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Measurable ROI</h3>
              <p className="text-muted-foreground text-sm">Track the direct impact on your brand's AI search performance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            Trusted by Forward-Thinking Brands
          </h2>
          <p className="text-lg text-muted-foreground mb-12">
            Join companies who've chosen focus over feature bloat
          </p>
          
          <Card className="p-8 max-w-2xl mx-auto">
            <blockquote className="text-lg text-foreground mb-4">
              "Our local restaurant started appearing in AI search results for 'best pizza in downtown' after just 3 weeks. 
              Customer inquiries from AI searches increased by 180%."
            </blockquote>
            <cite className="text-muted-foreground">— Owner, Local Restaurant Chain</cite>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Cut Through the Noise?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your free trial today. No setup fees, no long-term contracts, no feature overwhelm.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/auth">Start Free Trial</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/pricing">View Pricing Plans</Link>
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            14-day free trial • No credit card required • Cancel anytime
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
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
