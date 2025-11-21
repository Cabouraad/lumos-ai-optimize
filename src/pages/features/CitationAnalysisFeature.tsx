import { Layout } from '@/components/Layout';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, TrendingUp, FileText, BarChart3, Globe, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CitationAnalysisFeature() {
  return (
    <Layout>
      <SEOHelmet 
        title="Citation Analysis - Track AI Model Citations | Llumos"
        description="Understand which content AI models trust and cite most. Track citations across ChatGPT, Claude, Perplexity, and more. Optimize your content for AI visibility."
      />
      
      <div className="space-y-12 pb-12">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
            <span className="text-sm font-medium">Citation Intelligence</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Discover What AI Models
            <span className="text-primary block mt-2">Actually Cite</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Track which of your pages AI models reference, understand citation patterns, 
            and identify content gaps to improve your AI search visibility.
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link to="/signup">Start Tracking Citations</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </section>

        {/* Key Benefits */}
        <section className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Top Cited Content</CardTitle>
                <CardDescription>
                  See which pages AI models cite most frequently across all platforms
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Content Type Analysis</CardTitle>
                <CardDescription>
                  Understand which content types perform best - blogs, docs, case studies, etc.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <Globe className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Competitive Insights</CardTitle>
                <CardDescription>
                  See how competitors' content gets cited compared to yours
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* How It Works */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">How Citation Analysis Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform monitors AI model responses to track which sources they cite and reference
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                  Track Prompts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add prompts relevant to your business. We test them across ChatGPT, Claude, 
                  Perplexity, and other AI platforms to see what they recommend.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                  Extract Citations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our system automatically extracts all citations, links, and references from AI responses, 
                  categorizing them by domain and content type.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                  Analyze Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Identify which pages get cited most, which content types perform best, 
                  and how your citation rate compares to competitors.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                  Get Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receive actionable insights on which content to create or optimize to increase 
                  your citation rate and AI visibility.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Key Features */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Powerful Citation Tracking Features</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Citation Health Dashboard
                  </h3>
                  <p className="text-muted-foreground">
                    Monitor your overall citation health with key metrics: total citations, 
                    unique pages cited, average citations per response, and top cited domain.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Multi-Platform Coverage
                  </h3>
                  <p className="text-muted-foreground">
                    Track citations across ChatGPT, Claude, Perplexity, Gemini, and other 
                    leading AI platforms in one unified dashboard.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Historical Trends
                  </h3>
                  <p className="text-muted-foreground">
                    View citation trends over time with 7, 30, and 90-day rolling windows 
                    to track your progress and identify opportunities.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Priority Recommendations
                  </h3>
                  <p className="text-muted-foreground">
                    Get AI-powered recommendations on which content to create or optimize 
                    based on citation gaps and competitive analysis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Use Cases */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Who Benefits from Citation Analysis?</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Marketers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground">
                  Understand which content types and topics get cited by AI models to inform 
                  your content strategy and maximize reach.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>SEO Teams</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground">
                  Optimize for AI search visibility alongside traditional SEO. Track which 
                  pages need improvement to increase citation rates.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Product Teams</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground">
                  Ensure your product documentation and resources are being cited by AI models 
                  when users ask about solutions in your space.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="container max-w-4xl mx-auto text-center space-y-6 py-12">
          <h2 className="text-3xl font-bold">
            Start Tracking Your Citations Today
          </h2>
          <p className="text-xl text-muted-foreground">
            Join hundreds of companies optimizing their content for AI visibility
          </p>
          <Button size="lg" asChild>
            <Link to="/signup">Get Started Free</Link>
          </Button>
        </section>
      </div>
    </Layout>
  );
}
