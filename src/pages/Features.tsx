import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Target, 
  TrendingUp, 
  Zap, 
  CheckCircle, 
  ArrowRight,
  BarChart3,
  AlertTriangle,
  Users,
  Globe,
  Eye,
  Lightbulb,
  Shield,
  Clock,
  RefreshCw
} from 'lucide-react';

const Features = () => {
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
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/features" className="text-foreground font-medium">Features</Link>
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
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            Essential AI Search Features
            <span className="text-primary block">That Actually Drive Results</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            We've stripped away the noise and focused on the three core capabilities that make or break your AI search performance. No fluff, no overwhelm, just results.
          </p>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-12">
            
            {/* Feature 1: Brand Visibility Monitoring */}
            <div className="space-y-8">
              <Card className="p-8 h-full">
                <Target className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-4">Brand Visibility Monitoring</h2>
                <p className="text-muted-foreground mb-6">
                  Real-time tracking of your brand's presence across all major AI search platforms. Know exactly when and how you appear in AI responses.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Eye className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Multi-Platform Coverage</h4>
                      <p className="text-sm text-muted-foreground">Monitor ChatGPT, Gemini, Perplexity, and more</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Visibility Scoring</h4>
                      <p className="text-sm text-muted-foreground">Quantified metrics for tracking improvement over time</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Sentiment Analysis</h4>
                      <p className="text-sm text-muted-foreground">Understand how AI models perceive and present your brand</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Automated Tracking</h4>
                      <p className="text-sm text-muted-foreground">Daily scans with instant alerts for changes</p>
                    </div>
                  </div>
                </div>

                {/* Visibility Impact */}
                <div className="border-t pt-6 mb-6">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    How This Helps You Get Found
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Businesses tracking their brand visibility see 47% improvement in AI search presence within 90 days. Understanding where you currently appear is the first step to optimization success.
                  </p>
                </div>

                <Button asChild className="w-full">
                  <Link to="/features/brand-visibility">
                    Learn More <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </Card>
            </div>

            {/* Feature 2: Competitive Analysis */}
            <div className="space-y-8">
              <Card className="p-8 h-full">
                <TrendingUp className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-4">Competitive Analysis</h2>
                <p className="text-muted-foreground mb-6">
                  See exactly where competitors dominate AI search results and identify untapped opportunities to outrank them.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Competitor Benchmarking</h4>
                      <p className="text-sm text-muted-foreground">Track up to 10 competitors across all AI platforms</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Gap Analysis</h4>
                      <p className="text-sm text-muted-foreground">Identify queries where competitors rank but you don't</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Market Share Insights</h4>
                      <p className="text-sm text-muted-foreground">See your share of voice in AI search results</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Trend Analysis</h4>
                      <p className="text-sm text-muted-foreground">Track competitor performance changes over time</p>
                    </div>
                  </div>
                </div>

                {/* Competitive Impact */}
                <div className="border-t pt-6 mb-6">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    How This Helps You Get Found
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Strategic competitive analysis helps businesses gain market share 3x faster. Identify exactly where competitors outrank you and discover untapped opportunities.
                  </p>
                </div>

                <Button asChild className="w-full">
                  <Link to="/features/competitive-analysis">
                    Learn More <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </Card>
            </div>

            {/* Feature 3: Actionable Recommendations */}
            <div className="space-y-8">
              <Card className="p-8 h-full">
                <Zap className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-4">Actionable Recommendations</h2>
                <p className="text-muted-foreground mb-6">
                  Skip the guesswork. Get specific, prioritized actions you can implement today to improve your AI search rankings.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">AI-Powered Insights</h4>
                      <p className="text-sm text-muted-foreground">Machine learning identifies optimization opportunities</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Priority Scoring</h4>
                      <p className="text-sm text-muted-foreground">Focus on changes with the highest impact potential</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Content Optimization</h4>
                      <p className="text-sm text-muted-foreground">Specific suggestions for website and content improvements</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Implementation Tracking</h4>
                      <p className="text-sm text-muted-foreground">Mark recommendations complete and track results</p>
                    </div>
                  </div>
                </div>

                {/* Recommendations Impact */}
                <div className="border-t pt-6 mb-6">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    How This Helps You Get Found
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Data-driven recommendations deliver results 5x faster than generic optimization. Get specific, prioritized actions backed by successful case studies.
                  </p>
                </div>

                <Button asChild className="w-full">
                  <Link to="/features/actionable-recommendations">
                    Learn More <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Coverage */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Complete AI Platform Coverage
            </h2>
            <p className="text-xl text-muted-foreground">
              Monitor your brand across all major AI search platforms in one unified dashboard
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">ChatGPT</h3>
              <p className="text-sm text-muted-foreground">OpenAI's flagship model</p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Gemini</h3>
              <p className="text-sm text-muted-foreground">Google's AI model</p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Perplexity</h3>
              <p className="text-sm text-muted-foreground">AI-powered search engine</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Enterprise-Ready Foundation
            </h2>
            <p className="text-xl text-muted-foreground">
              Built for scale with the security and reliability your business demands
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Enterprise Security</h3>
              <p className="text-muted-foreground">SOC 2 compliant with bank-level encryption and data protection standards.</p>
            </div>
            
            <div className="text-center">
              <Clock className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">99.9% Uptime</h3>
              <p className="text-muted-foreground">Reliable monitoring with redundant systems and 24/7 infrastructure monitoring.</p>
            </div>
            
            <div className="text-center">
              <Users className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Team Collaboration</h3>
              <p className="text-muted-foreground">Multi-user access with role-based permissions and shared dashboards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            See These Features in Action
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your free trial and experience the focused approach to AI search optimization.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <Link to="/auth">Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></Link>
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
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Features;