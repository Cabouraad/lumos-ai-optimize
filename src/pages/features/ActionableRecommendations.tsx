import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Search, 
  Zap, 
  ArrowRight,
  Target,
  Lightbulb,
  Globe,
  CheckCircle,
  TrendingUp,
  Star,
  Clock,
  BarChart3
} from 'lucide-react';
import actionableRecommendationsHero from '@/assets/actionable-recommendations-hero.jpg';

const ActionableRecommendations = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Actionable Recommendations - AI Search Optimization Guide | Llumos</title>
        <meta name="description" content="Get specific, prioritized recommendations to improve your AI search rankings. AI-powered insights with implementation tracking and impact scoring." />
        <meta property="og:title" content="Actionable Recommendations - AI Search Optimization Guide" />
        <meta property="og:description" content="Skip the guesswork. Get specific, prioritized actions you can implement today to improve your AI search rankings." />
        <meta property="og:image" content={actionableRecommendationsHero} />
        <link rel="canonical" href="https://llumos.ai/features/actionable-recommendations" />
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

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                Actionable
                <span className="text-primary block">Recommendations</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Skip the guesswork. Get specific, prioritized actions you can implement today to improve your AI search rankings. Every recommendation is backed by data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/signup">Get Recommendations <ArrowRight className="ml-2 w-5 h-5" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
                  <Link to="/features">All Features</Link>
                </Button>
              </div>
            </div>
            <div>
              <img 
                src={actionableRecommendationsHero} 
                alt="Actionable recommendations dashboard showing optimization suggestions and priority scoring"
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
              Smart Optimization Recommendations
            </h2>
            <p className="text-xl text-muted-foreground">
              Data-driven insights that tell you exactly what to optimize and why
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Lightbulb className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">AI-Powered Insights</h3>
              <p className="text-muted-foreground">
                Machine learning algorithms analyze your brand's AI search performance and identify specific optimization opportunities with highest impact potential.
              </p>
            </Card>
            
            <Card className="p-6">
              <Target className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Priority Scoring</h3>
              <p className="text-muted-foreground">
                Every recommendation comes with an impact score, helping you focus on changes that will deliver the biggest improvements to your AI search visibility.
              </p>
            </Card>
            
            <Card className="p-6">
              <Globe className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Content Optimization</h3>
              <p className="text-muted-foreground">
                Specific suggestions for website content, page structure, and information architecture to improve how AI models understand and reference your brand.
              </p>
            </Card>
            
            <Card className="p-6">
              <CheckCircle className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Implementation Tracking</h3>
              <p className="text-muted-foreground">
                Mark recommendations as complete and track the impact on your AI search performance. See which optimizations drive the best results.
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
              How We Generate Recommendations
            </h2>
            <p className="text-xl text-muted-foreground">
              Our AI analyzes hundreds of factors to identify your best optimization opportunities
            </p>
          </div>
          
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Data Analysis</h3>
                <p className="text-muted-foreground">
                  Our AI analyzes your brand's performance across thousands of queries and compares it to successful competitors.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Advanced machine learning models process visibility scores, sentiment analysis, competitive gaps, and content quality metrics.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Opportunity Identification</h3>
                <p className="text-muted-foreground">
                  AI identifies specific optimization opportunities based on successful patterns from high-performing brands.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Each recommendation is backed by data showing exactly why this optimization will improve your AI search performance.
                  </p>
                </Card>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/3">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Priority & Implementation</h3>
                <p className="text-muted-foreground">
                  Recommendations are prioritized by impact potential and include specific implementation guidance.
                </p>
              </div>
              <div className="md:w-2/3">
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    Clear, actionable steps with priority scores help you implement the most impactful optimizations first.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recommendations Impact */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Actionable Recommendations Help You Get Found in AI Search
            </h2>
            <p className="text-xl text-muted-foreground">
              Strategic, data-driven optimization is the fastest path to AI search success
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">Generic Optimization Approach</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Guesswork leads to wasted optimization efforts</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>No clear prioritization of optimization tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>Months of work with minimal results</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <span>No way to measure optimization success</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">Our Recommendation System</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Data-driven recommendations with clear impact scores</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Priority-based task list for maximum efficiency</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>See results within weeks of implementation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Track optimization impact with detailed metrics</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Card className="p-8 bg-background">
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                5x Faster Optimization Results
              </h3>
              <p className="text-muted-foreground mb-6">
                Businesses following our actionable recommendations see improvements 5x faster than generic optimization approaches.
              </p>
              <Button asChild>
                <Link to="/signup">Get Your Recommendations</Link>
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
              Recommendation Categories
            </h2>
            <p className="text-xl text-muted-foreground">
              Comprehensive optimization guidance across all aspects of AI search performance
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <Globe className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Content Optimization</h3>
              <p className="text-muted-foreground mb-4">
                Specific improvements to website content, structure, and information architecture.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Page content enhancements</li>
                <li>• Information architecture improvements</li>
                <li>• Schema markup additions</li>
                <li>• Content gap identification</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <Target className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Strategic Positioning</h3>
              <p className="text-muted-foreground mb-4">
                Brand positioning and messaging optimizations for better AI understanding.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Brand messaging refinement</li>
                <li>• Competitive differentiation</li>
                <li>• Authority building strategies</li>
                <li>• Expertise demonstration</li>
              </ul>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Technical Optimization</h3>
              <p className="text-muted-foreground mb-4">
                Technical improvements to help AI models better understand and cite your content.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Structured data implementation</li>
                <li>• Site performance optimization</li>
                <li>• Crawlability improvements</li>
                <li>• Mobile optimization</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Metrics & Tracking */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Track Your Optimization Success
            </h2>
            <p className="text-xl text-muted-foreground">
              Every recommendation comes with clear success metrics and impact tracking
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Star className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Impact Scoring</h3>
              <p className="text-muted-foreground mb-4">
                Each recommendation includes a predicted impact score based on similar successful optimizations.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>High Impact</span>
                  <span className="text-green-600">+15-30% visibility</span>
                </div>
                <div className="flex justify-between">
                  <span>Medium Impact</span>
                  <span className="text-yellow-600">+5-15% visibility</span>
                </div>
                <div className="flex justify-between">
                  <span>Low Impact</span>
                  <span className="text-orange-600">+2-5% visibility</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <Clock className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Implementation Tracking</h3>
              <p className="text-muted-foreground mb-4">
                Mark recommendations as complete and track their real-world impact on your AI search performance.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Task completion tracking</li>
                <li>• Before/after performance comparison</li>
                <li>• ROI measurement</li>
                <li>• Success rate analysis</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Get Your Personalized Recommendations
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your free trial and get actionable recommendations for your brand within 24 hours.
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
            14-day free trial • No credit card required • Personalized recommendations included
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

export default ActionableRecommendations;