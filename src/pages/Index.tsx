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
import { ScrollingAIText } from '@/components/ScrollingAIText';
import { Logo } from '@/components/Logo';

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

        {/* Black Friday Promo Banner */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-primary border-b border-primary/20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-primary-foreground animate-pulse" />
                <div>
                  <p className="text-primary-foreground font-bold text-lg">
                    Black Friday Special: Get 1 Year for Only $99!
                  </p>
                  <p className="text-primary-foreground/90 text-sm">
                    Limited time offer - Save over 60% on Starter Tier
                  </p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="lg"
                className="shrink-0 bg-background hover:bg-background/90 text-primary font-semibold shadow-lg"
                asChild
              >
                <Link to="/black-friday">
                  Claim Deal
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative pt-20 md:pt-32 pb-8 md:pb-12 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
          
          <div className="container max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12 space-y-6 animate-fade-in">
              {/* Large Logo */}
              <div className="flex justify-center mb-8">
                <div className="scale-[2.5] md:scale-[3]">
                  <Logo />
                </div>
              </div>
              
              <Badge variant="outline" className="mx-auto w-fit px-4 py-2 border-primary/20">
                <Sparkles className="w-4 h-4 mr-2 inline-block" />
                AI Visibility Analytics Platform
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.15]">
                <span className="block">Understand how</span>
                <span className="block"><ScrollingAIText /></span>
                <span className="block">is talking about your brand</span>
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
              <Card className="group relative p-8 hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary hover:scale-110 bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg w-fit transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg group-hover:shadow-primary/50">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">Real-time monitoring</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Stay informed with up-to-date AI visibility analytics
                  </p>
                </div>
              </Card>
              
              <Card className="group relative p-8 hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary hover:scale-110 bg-gradient-to-br from-background via-background to-secondary/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-gradient-to-br from-primary/20 to-secondary/5 rounded-lg w-fit transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-lg group-hover:shadow-primary/50">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">Boost AI presence</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Increase your brand's prominence across AI platforms
                  </p>
                </div>
              </Card>
              
              <Card className="group relative p-8 hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary hover:scale-110 bg-gradient-to-br from-background via-background to-accent/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-gradient-to-br from-primary/20 to-accent/5 rounded-lg w-fit transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg group-hover:shadow-primary/50">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">Competitive edge</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Gain actionable insights to stay ahead of competitors
                  </p>
                </div>
              </Card>
              
              <Card className="group relative p-8 hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary hover:scale-110 bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg w-fit transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-lg group-hover:shadow-primary/50">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">Precise targeting</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Engage your ideal customers more effectively
                  </p>
                </div>
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
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center max-w-4xl mx-auto">
              <div className="group flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:shadow-glow group-hover:scale-110 transition-all duration-300">
                  <Search className="w-8 h-8 text-primary group-hover:animate-pulse" />
                </div>
                <span className="text-lg font-semibold group-hover:text-primary transition-colors">Google AI Overviews</span>
              </div>
              <div className="group flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/5 flex items-center justify-center group-hover:shadow-glow group-hover:scale-110 transition-all duration-300">
                  <Sparkles className="w-8 h-8 text-primary group-hover:animate-pulse" />
                </div>
                <span className="text-lg font-semibold group-hover:text-primary transition-colors">Gemini</span>
              </div>
              <div className="group flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/5 flex items-center justify-center group-hover:shadow-glow group-hover:scale-110 transition-all duration-300">
                  <Eye className="w-8 h-8 text-primary group-hover:animate-pulse" />
                </div>
                <span className="text-lg font-semibold group-hover:text-primary transition-colors">Perplexity</span>
              </div>
              <div className="group flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:shadow-glow group-hover:scale-110 transition-all duration-300">
                  <Zap className="w-8 h-8 text-primary group-hover:animate-pulse" />
                </div>
                <span className="text-lg font-semibold group-hover:text-primary transition-colors">ChatGPT</span>
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
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-primary rounded-xl blur-lg opacity-30 animate-pulse"></div>
                <Card className="relative p-8 shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 backdrop-blur">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Visibility Score</span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent animate-fade-in">82%</span>
                    </div>
                    <div className="space-y-4">
                      <div className="group">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="group-hover:text-primary transition-colors">ChatGPT</span>
                          <span className="font-semibold group-hover:text-primary transition-colors">89%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-1000 group-hover:shadow-glow" style={{ width: '89%' }}></div>
                        </div>
                      </div>
                      
                      <div className="group">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="group-hover:text-primary transition-colors">Gemini</span>
                          <span className="font-semibold group-hover:text-primary transition-colors">76%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-secondary to-secondary/60 rounded-full transition-all duration-1000 group-hover:shadow-glow" style={{ width: '76%' }}></div>
                        </div>
                      </div>
                      
                      <div className="group">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="group-hover:text-primary transition-colors">Perplexity</span>
                          <span className="font-semibold group-hover:text-primary transition-colors">81%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-accent to-accent/60 rounded-full transition-all duration-1000 group-hover:shadow-glow" style={{ width: '81%' }}></div>
                        </div>
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
