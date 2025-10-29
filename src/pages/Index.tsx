import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { CheckCircle, Search, Target, TrendingUp, Zap, Shield, Clock, ArrowRight, Star, Quote, BarChart3, Users, DollarSign } from 'lucide-react';

const Index = () => {
  const { user, loading, orgData, orgStatus, ready, isChecking } = useAuth();
  const [showStickyBar, setShowStickyBar] = useState(false);

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
    <div className="min-h-screen bg-gradient-bg">
      {/* Sticky CTA Bar */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary shadow-elevated z-50 animate-fade-in">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-primary-foreground font-semibold">Start tracking your AI visibility today</span>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/auth">Start Free Trial <ArrowRight className="ml-1 w-4 h-4" /></Link>
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
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild className="shadow-glow">
              <Link to="/auth">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center relative overflow-hidden">
        <div className="container mx-auto max-w-5xl relative z-10">
          <Badge className="mb-4 text-sm py-1 px-4 shadow-soft">
            <Star className="w-3 h-3 mr-1 inline fill-current" />
            Trusted by 500+ B2B Marketing Teams
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in">
            Track Your Brand's AI Search Visibility
            <span className="text-primary block mt-2 bg-gradient-primary bg-clip-text text-transparent">Before Your Competitors Do</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Monitor how ChatGPT, Gemini, and other AI platforms mention your brand. 
            Get real-time insights and actionable recommendations to dominate AI search results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button size="lg" asChild className="text-lg px-10 py-7 shadow-glow hover-lift">
              <Link to="/auth">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-10 py-7">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            ✓ 7-day free trial  ✓ Payment method required  ✓ Setup in 5 minutes
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 bg-card/50 backdrop-blur border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="animate-fade-in">
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-muted-foreground">Active Clients</div>
            </div>
            <div className="animate-fade-in" style={{animationDelay: '0.1s'}}>
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
            Why Pay More for Less?
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

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4">Core Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple. Focused. Effective.
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

      {/* Social Proof - Enhanced */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge className="mb-4">Client Success Stories</Badge>
            <h2 className="text-4xl font-bold mb-4 text-foreground">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-muted-foreground">
              See how companies like yours are dominating AI search results
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 hover-lift shadow-soft">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <Quote className="w-10 h-10 text-primary/20 mb-4" />
              <p className="text-muted-foreground italic mb-6 leading-relaxed">
                "Our AI visibility increased 200% in just 60 days. We're now the top recommended solution in ChatGPT for our industry."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Sarah Chen</p>
                  <p className="text-sm text-muted-foreground">CMO, TechFlow</p>
                </div>
              </div>
            </Card>

            <Card className="p-8 hover-lift shadow-soft">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <Quote className="w-10 h-10 text-primary/20 mb-4" />
              <p className="text-muted-foreground italic mb-6 leading-relaxed">
                "Finally, a tool that shows real ROI. We tracked $2M in pipeline directly attributed to AI search visibility."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Michael Torres</p>
                  <p className="text-sm text-muted-foreground">VP Marketing, CloudScale</p>
                </div>
              </div>
            </Card>

            <Card className="p-8 hover-lift shadow-soft">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <Quote className="w-10 h-10 text-primary/20 mb-4" />
              <p className="text-muted-foreground italic mb-6 leading-relaxed">
                "Llumos revealed gaps our competitors were exploiting. Within 90 days, we outranked them in 85% of key queries."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Jennifer Park</p>
                  <p className="text-sm text-muted-foreground">Head of Growth, DataSync</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Trust Badges */}
          <div className="mt-16 pt-12 border-t">
            <p className="text-center text-sm text-muted-foreground mb-8">AS SEEN IN</p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
              <div className="text-2xl font-bold text-muted-foreground">TechCrunch</div>
              <div className="text-2xl font-bold text-muted-foreground">Forbes</div>
              <div className="text-2xl font-bold text-muted-foreground">Inc.</div>
              <div className="text-2xl font-bold text-muted-foreground">VentureBeat</div>
            </div>
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
            Join 500+ companies already winning in the AI search era
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button size="lg" variant="secondary" asChild className="text-lg px-10 py-7 shadow-elevated">
              <Link to="/auth">
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
      <footer className="py-12 px-4 border-t bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="w-6 h-6 text-primary" />
                <span className="text-xl font-bold text-foreground">Llumos</span>
              </div>
              <p className="text-muted-foreground text-sm">
                AI Search Optimization. Simplified.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Product</h4>
              <div className="space-y-2 text-sm">
                <Link to="/features" className="block text-muted-foreground hover:text-foreground">Features</Link>
                <Link to="/pricing" className="block text-muted-foreground hover:text-foreground">Pricing</Link>
                <Link to="/resources" className="block text-muted-foreground hover:text-foreground">Resources</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Company</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground">About</a>
                <a href="#" className="block text-muted-foreground hover:text-foreground">Blog</a>
                <a href="#" className="block text-muted-foreground hover:text-foreground">Careers</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Legal</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground">Privacy</a>
                <a href="#" className="block text-muted-foreground hover:text-foreground">Terms</a>
                <a href="#" className="block text-muted-foreground hover:text-foreground">Security</a>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            © 2025 Llumos. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
