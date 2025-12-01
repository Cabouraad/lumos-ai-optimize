import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw,
  Star,
  Award,
  Sparkles,
  FileText,
  Bot
} from 'lucide-react';
import { SEOHelmet } from '@/components/SEOHelmet';

const Features = () => {
  return (
    <>
      <SEOHelmet
        title="Features - AI Search Visibility Platform"
        description="Explore Llumos features: brand visibility monitoring, competitive analysis, actionable recommendations, and multi-platform AI search tracking across ChatGPT, Gemini, and Perplexity."
        keywords="AI visibility features, brand monitoring, competitive analysis, ChatGPT tracking, AI SEO tools, Perplexity monitoring"
        canonicalPath="/features"
        ogImage="/og-home.png"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Llumos",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          featureList: [
            "Brand Visibility Monitoring",
            "Competitive Analysis", 
            "Actionable Recommendations",
            "Multi-Platform AI Coverage",
            "Real-Time Tracking",
            "Content Optimization"
          ]
        }}
      />
      <div className="min-h-screen bg-gradient-bg">
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
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild className="shadow-glow">
              <Link to="/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="container mx-auto text-center max-w-5xl relative z-10">
          <Badge className="mb-6 text-sm py-1 px-4 shadow-soft animate-fade-in">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            Complete AI Search Optimization Platform
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight animate-fade-in">
            Powerful Features Built For
            <span className="text-primary block mt-2 bg-gradient-primary bg-clip-text text-transparent">AI Search Domination</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Everything you need to monitor, analyze, and optimize your brand's presence across all major AI platforms - in one unified dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="shadow-glow hover-lift">
              <Link to="/free-checker">
                See How It Works - Free Report
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/signup">Start 7-Day Free Trial</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value Props Bar */}
      <section className="py-8 px-4 bg-card/50 backdrop-blur border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <Award className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Industry-Leading Accuracy</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Clock className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Real-Time Monitoring</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Star className="w-6 h-6 text-primary fill-primary" />
              <span className="text-sm font-medium text-foreground">4.9/5 Customer Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-12">
            
            {/* Feature 1: Brand Visibility Monitoring */}
            <div className="space-y-8">
              <Card className="p-8 h-full hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Brand Visibility Monitoring</h2>
                <p className="text-muted-foreground mb-6">
                  Real-time tracking of your brand's presence across all major AI search platforms. Know exactly when and how you appear in AI responses.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Eye className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground">Multi-Platform Coverage</h4>
                      <p className="text-sm text-muted-foreground">Monitor ChatGPT, Gemini, Perplexity, Google AI Overviews, and more</p>
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
              <Card className="p-8 h-full hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
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
              <Card className="p-8 h-full hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
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
              Monitor your brand across all 4 major AI search platforms in one unified dashboard
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 text-center hover-lift">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Search className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">ChatGPT</h3>
              <p className="text-sm text-muted-foreground">OpenAI's flagship model</p>
              <Badge className="mt-3 text-xs" variant="secondary">Most Popular</Badge>
            </Card>
            
            <Card className="p-6 text-center hover-lift">
              <div className="w-16 h-16 bg-gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Search className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Gemini</h3>
              <p className="text-sm text-muted-foreground">Google's AI model</p>
              <Badge className="mt-3 text-xs" variant="secondary">Enterprise</Badge>
            </Card>
            
            <Card className="p-6 text-center hover-lift">
              <div className="w-16 h-16 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Search className="w-8 h-8 text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Perplexity</h3>
              <p className="text-sm text-muted-foreground">AI-powered search engine</p>
              <Badge className="mt-3 text-xs" variant="secondary">Growing Fast</Badge>
            </Card>
            
            <Card className="p-6 text-center hover-lift">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Google AI Overviews</h3>
              <p className="text-sm text-muted-foreground">Enhanced search results</p>
              <Badge className="mt-3 text-xs" variant="secondary">Essential</Badge>
            </Card>
          </div>
          
          {/* Additional Platform Info */}
          <div className="mt-12 text-center">
            <Card className="p-6 bg-accent/5 border-accent/20">
              <p className="text-muted-foreground mb-2">
                <strong className="text-foreground">Track across all platforms simultaneously</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Get a unified view of your AI search presence with automated daily scans and instant notifications when your visibility changes.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Content Studio - AEO/GEO Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge className="mb-4">
              <Bot className="w-3 h-3 mr-1 inline" />
              Answer Engine Optimization
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Content Studio for AEO & GEO
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Create AI-optimized content that ranks in ChatGPT, Google AI Overviews, Perplexity, and other generative AI platforms
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <Card className="p-8 hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">AI Content Blueprints</h3>
              <p className="text-muted-foreground mb-6">
                Transform visibility gaps into detailed content frameworks. Get structured outlines, FAQ suggestions, 
                key entities, and schema markup recommendations designed for maximum AI citation potential.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>LLM-targeted content types (FAQ, blog, comparison pages)</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Schema markup recommendations for AI parsing</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Entity and keyword optimization for GEO</span>
                </li>
              </ul>
            </Card>
            
            <Card className="p-8 hover-lift border-2 hover:border-primary/50 transition-all shadow-soft">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">AI Writing Assistance</h3>
              <p className="text-muted-foreground mb-6">
                Create content directly in Llumos with built-in AI assistance. Get suggestions, expand sections, 
                and ensure your content follows Answer Engine Optimization and Generative Engine Optimization best practices.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Section-by-section AI writing suggestions</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Tone and brand voice consistency</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Export to Markdown and HTML</span>
                </li>
              </ul>
            </Card>
          </div>
          
          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/features/content-studio">
                Learn More About Content Studio
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-16 px-4 bg-muted/30">
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

      {/* ROI Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge className="mb-4">Proven Results</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Real Results From Real Customers
            </h2>
            <p className="text-xl text-muted-foreground">
              See the measurable impact these features deliver
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 border-2 border-success/20 bg-success/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-success mb-2">200%</div>
                  <h4 className="font-semibold text-foreground mb-2">Average Visibility Increase</h4>
                  <p className="text-muted-foreground text-sm">
                    Companies using our platform see their AI search visibility double within the first 90 days of implementation.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 border-2 border-primary/20 bg-primary/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">3.2M</div>
                  <h4 className="font-semibold text-foreground mb-2">Additional Impressions/Month</h4>
                  <p className="text-muted-foreground text-sm">
                    Average increase in brand mentions across AI platforms for our enterprise customers.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 border-2 border-accent/20 bg-accent/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-accent mb-2">85%</div>
                  <h4 className="font-semibold text-foreground mb-2">Competitive Win Rate</h4>
                  <p className="text-muted-foreground text-sm">
                    Percentage of tracked queries where users outrank their top 3 competitors after 6 months.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 border-2 border-warning/20 bg-warning/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-warning mb-2">12 hrs</div>
                  <h4 className="font-semibold text-foreground mb-2">Time Saved Per Week</h4>
                  <p className="text-muted-foreground text-sm">
                    Average time marketing teams save by automating AI search monitoring and analysis.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your AI Visibility?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of companies already dominating AI search results
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button size="lg" variant="secondary" asChild className="text-lg px-10 py-7 shadow-elevated hover-lift">
              <Link to="/signup">Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-lg px-10 py-7 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
          
          <p className="text-sm opacity-80">
            ✓ 7-day free trial  ✓ Cancel anytime  ✓ Expert support included
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/features/content-studio" className="hover:text-foreground transition-colors">Content Studio</Link>
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
            <Link to="/signin" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Features;