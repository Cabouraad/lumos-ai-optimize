import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { CheckCircle, Search, Target, TrendingUp, Zap, Shield, Clock, ArrowRight, BarChart3, Eye, Users, Sparkles } from 'lucide-react';
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

  if (user && orgData && orgStatus === 'success') {
    return <Navigate to="/dashboard" replace />;
  }

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
      <div className="min-h-screen bg-background">
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
              <span className="text-2xl font-bold">Llumos</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/signin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
              <Button size="sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-20 md:py-32 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
          
          <div className="container max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12 space-y-6 animate-fade-in">
              <Badge variant="outline" className="mx-auto w-fit px-4 py-2 border-primary/20">
                <Sparkles className="w-4 h-4 mr-2 inline-block" />
                AI Visibility Analytics Platform
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                Understand how <span className="text-primary">AI</span> is
                <br />
                talking about your brand
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Track your AI visibility, see where and how AI mentions your brand, and uncover insights to enhance your presence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                <Button 
                  size="lg" 
                  className="px-8 h-12 text-base shadow-glow" 
                  asChild
                >
                  <Link to="/signup" onClick={() => trackCtaClick('hero-cta')}>Get Started</Link>
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="px-8 h-12 text-base" 
                  asChild
                >
                  <Link to="/features">Learn More</Link>
                </Button>
              </div>
              
              <div className="flex items-center justify-center flex-wrap gap-6 text-sm text-muted-foreground pt-4">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Instant results
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Free analysis
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Proof Section */}
        <ProofSection />

        {/* Key Features Grid */}
        <section className="py-20 px-4 bg-muted/20">
          <div className="container max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Visibility analytics for the AI era</h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                AI has fundamentally changed how people discover brands and make purchase decisions. Llumos empowers marketers with deep AI visibility analytics and agnostic optimization tools to maximize reach.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-8 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:scale-105">
                <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-time monitoring</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Stay informed with up-to-date AI visibility analytics
                </p>
              </Card>
              
              <Card className="p-8 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:scale-105">
                <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Boost AI presence</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Increase your brand's prominence across AI platforms
                </p>
              </Card>
              
              <Card className="p-8 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:scale-105">
                <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Competitive edge</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Gain actionable insights to stay ahead of competitors
                </p>
              </Card>
              
              <Card className="p-8 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:scale-105">
                <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Precise targeting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Engage your ideal customers more effectively
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Score Checker */}
        <LlumosScoreChecker />

        {/* Platform Coverage */}
        <section className="py-20 px-4 border-t">
          <div className="container max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mx-auto w-fit px-4 py-2 mb-6 border-primary/20">
              Platform Coverage
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Track all leading AI platforms</h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Comprehensive monitoring across every major AI search and answer platform
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-items-center">
              <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <span className="text-lg font-semibold">ChatGPT</span>
              </div>
              <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <span className="text-lg font-semibold">Gemini</span>
              </div>
              <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-primary" />
                </div>
                <span className="text-lg font-semibold">Perplexity</span>
              </div>
              <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <span className="text-lg font-semibold">Claude</span>
              </div>
              <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity col-span-2 md:col-span-1">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <span className="text-lg font-semibold">Meta AI</span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 px-4 bg-muted/20">
          <div className="container max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge variant="outline" className="w-fit px-4 py-2 border-primary/20">
                  Benefits
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold">Be the answer in AI search</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Customers today seek answers, not links. Llumos helps brands adapt to the new customer journey and be part of the answer.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Monitor brand presence</h4>
                      <p className="text-muted-foreground">Stay informed with real-time monitoring of your visibility in AI ecosystems</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Understand your competitive position</h4>
                      <p className="text-muted-foreground">Track how competitors appear and discover the secret cited domains</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Identify opportunities</h4>
                      <p className="text-muted-foreground">Get customized recommendations to improve your presence in AI conversations</p>
                    </div>
                  </li>
                </ul>
              </div>
              
              <div className="relative">
                <Card className="p-8 shadow-2xl border-2">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Visibility Score</span>
                      <span className="text-3xl font-bold text-primary">82%</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>ChatGPT</span>
                        <span className="font-semibold">89%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '89%' }}></div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>Gemini</span>
                        <span className="font-semibold">76%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '76%' }}></div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>Perplexity</span>
                        <span className="font-semibold">81%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '81%' }}></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 border-t">
          <div className="container max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold">Ready to optimize your AI visibility?</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Join leading brands tracking their AI presence. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="px-8 h-12 text-base shadow-glow" 
                asChild
              >
                <Link to="/signup" onClick={() => trackCtaClick('final-cta')}>Start Free Trial</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 h-12 text-base" 
                asChild
              >
                <Link to="/features">View All Features</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">No credit card required • Free 14-day trial</p>
          </div>
        </section>

        <Footer />
        <LinkedInPixel />
        <GoogleAnalytics />
      </div>
    </>
  );
};

export default Index;
