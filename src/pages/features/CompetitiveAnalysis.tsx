import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Search, 
  TrendingUp, 
  ArrowRight,
  BarChart3,
  Target,
  Users,
  Zap,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Eye
} from 'lucide-react';
import competitiveAnalysisHero from '@/assets/competitive-analysis-hero.jpg';

const CompetitiveAnalysis = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Competitive Analysis - AI Search Intelligence | Llumos</title>
        <meta name="description" content="Analyze competitors' AI search performance across ChatGPT, Gemini, and Perplexity. Identify gaps, benchmark performance, and discover untapped opportunities." />
        <meta property="og:title" content="Competitive Analysis - AI Search Intelligence" />
        <meta property="og:description" content="See exactly where competitors dominate AI search results and identify opportunities to outrank them." />
        <meta property="og:image" content={competitiveAnalysisHero} />
        <link rel="canonical" href="https://llumos.ai/features/competitive-analysis" />
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
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                Competitive
                <span className="text-primary block">Analysis</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                See exactly where competitors dominate AI search results and identify untapped opportunities to outrank them. Strategic intelligence for AI search optimization.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/auth">Start Analysis <ArrowRight className="ml-2 w-5 h-5" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/features">All Features</Link>
                </Button>
              </div>
            </div>
            <div>
              <img 
                src={competitiveAnalysisHero} 
                alt="Competitive analysis dashboard showing competitor rankings and market share data"
                className="w-full h-auto rounded-lg shadow-lg"
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
              Comprehensive Competitive Intelligence
            </h2>
            <p className="text-xl text-muted-foreground">
              Understand your competitive landscape across all major AI search platforms
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Users className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Competitor Benchmarking</h3>
              <p className="text-muted-foreground">
                Track up to 10 competitors across all AI platforms. See exactly how they perform compared to your brand in AI search results.
              </p>
            </Card>
            
            <Card className="p-6">
              <Target className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Gap Analysis</h3>
              <p className="text-muted-foreground">
                Identify specific queries where competitors rank prominently but your brand is absent. Discover untapped optimization opportunities.
              </p>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Market Share Insights</h3>
              <p className="text-muted-foreground">
                Understand your share of voice in AI search results. Track how market dynamics change over time in your industry.
              </p>
            </Card>
            
            <Card className="p-6">
              <TrendingUp className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Trend Analysis</h3>
              <p className="text-muted-foreground">
                Monitor competitor performance changes over time. Identify emerging threats and opportunities in your market.
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
              How Competitive Analysis Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Our systematic approach to understanding your competitive landscape
            </p>
          </div>
          
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Competitor Identification</h3>
                <p className="text-muted-foreground">
                  Add your direct competitors and we'll automatically discover related brands mentioned alongside yours in AI responses.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Our AI identifies both obvious competitors and unexpected brands that compete for the same AI search visibility.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Multi-Platform Tracking</h3>
                <p className="text-muted-foreground">
                  Daily monitoring of competitor mentions across ChatGPT, Gemini, Perplexity, and other AI platforms.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Comprehensive tracking across thousands of industry-relevant queries to map competitive positioning.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Strategic Analysis</h3>
                <p className="text-muted-foreground">
                  Advanced analytics identify gaps, opportunities, and competitive advantages in AI search results.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Machine learning algorithms analyze competitive patterns and identify strategic optimization opportunities.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Intelligence Impact */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Competitive Analysis Helps You Get Found in AI Search
            </h2>
            <p className="text-xl text-muted-foreground">
              Strategic competitive intelligence is the key to outperforming rivals in AI search results
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">Without Competitive Intelligence</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Competitors dominate 65% of industry queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>You're unaware of competitive threats and opportunities</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>No strategy to differentiate your brand in AI responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Missing 40%+ of potential market opportunities</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">With Our Competitive Analysis</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Identify exactly where competitors outrank you</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Discover untapped query opportunities</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Develop data-driven differentiation strategies</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Track competitive threats in real-time</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Card className="p-8 bg-background">
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                3x Faster Market Share Growth
              </h3>
              <p className="text-muted-foreground mb-6">
                Businesses using competitive analysis gain market share 3x faster than those optimizing blindly.
              </p>
              <Button asChild>
                <Link to="/auth">Start Your Analysis</Link>
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
              Key Competitive Analysis Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to understand and outperform your competition
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <Users className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Competitor Mapping</h3>
              <p className="text-muted-foreground mb-4">
                Comprehensive competitor identification and performance tracking across all AI platforms.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Direct competitor analysis</li>
                <li>• Indirect competitor discovery</li>
                <li>• Market positioning insights</li>
                <li>• Competitive strength scoring</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Market Share Analysis</h3>
              <p className="text-muted-foreground mb-4">
                Detailed analysis of market share distribution and competitive dynamics.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Share of voice metrics</li>
                <li>• Platform-specific performance</li>
                <li>• Industry benchmarking</li>
                <li>• Growth trend analysis</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <Target className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Opportunity Identification</h3>
              <p className="text-muted-foreground mb-4">
                Strategic identification of gaps and opportunities in competitive landscape.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Query gap analysis</li>
                <li>• Weak competitor identification</li>
                <li>• Emerging trend detection</li>
                <li>• Strategic opportunity scoring</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Your Competitive Analysis Workflow
            </h2>
            <p className="text-xl text-muted-foreground">
              From setup to strategic advantage in minutes
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">1</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Add Competitors</h3>
                <p className="text-muted-foreground">Simply add your known competitors, and our AI will discover related brands automatically.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">2</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Review Analysis</h3>
                <p className="text-muted-foreground">Get comprehensive competitive intelligence reports within 24 hours of setup.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">3</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Identify Opportunities</h3>
                <p className="text-muted-foreground">Discover specific queries and platforms where you can outrank competitors.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">4</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Track Progress</h3>
                <p className="text-muted-foreground">Monitor your competitive position changes over time with detailed trend analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Outperform Your Competition
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get the competitive intelligence you need to dominate AI search results.
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
            14-day free trial • No credit card required • Full competitive analysis
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
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CompetitiveAnalysis;