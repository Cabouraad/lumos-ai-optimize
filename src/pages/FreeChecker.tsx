import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  BarChart3, 
  CheckCircle, 
  ArrowRight, 
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Zap
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SEOHelmet, structuredDataGenerators } from '@/components/SEOHelmet';

const INDUSTRIES = [
  "Software & Technology",
  "E-commerce & Retail",
  "Healthcare & Medical",
  "Financial Services",
  "Marketing & Advertising",
  "Education & Training",
  "Real Estate",
  "Manufacturing",
  "Professional Services",
  "Other"
];

export default function FreeChecker() {
  const [brandName, setBrandName] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [competitor1, setCompetitor1] = useState('');
  const [competitor2, setCompetitor2] = useState('');
  const [competitor3, setCompetitor3] = useState('');
  const [industry, setIndustry] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Generate simulated scores based on brand name (deterministic)
  const generateScore = (name: string, offset: number = 0): number => {
    if (!name) return 0;
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Math.min(10, Math.max(3, ((hash + offset) % 6) + 4));
  };

  const handleAnalyze = async () => {
    if (!brandName || !industry || !domain || !email) return;
    
    setIsAnalyzing(true);
    
    try {
      // Save lead to database
      const { error: leadError } = await supabase
        .from('free_checker_leads')
        .insert({
          email,
          domain,
          brand_name: brandName,
          industry,
          competitors: [competitor1, competitor2, competitor3].filter(Boolean)
        });

      if (leadError) {
        console.error('Error saving lead:', leadError);
      }

      // Call edge function for analysis
      const { data, error } = await supabase.functions.invoke('analyze-free-checker', {
        body: {
          brandName,
          domain,
          industry,
          competitors: [competitor1, competitor2, competitor3].filter(Boolean)
        }
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Failed to analyze. Showing sample results.');
      } else if (data) {
        setAnalysisData(data);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Failed to analyze. Showing sample results.');
    } finally {
      setShowResults(true);
      setIsAnalyzing(false);
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Use analysis data if available, otherwise fall back to simulated scores
  const brandScore = analysisData?.overallScore || generateScore(brandName, 0);
  const platformScores = analysisData?.platformScores || {
    chatgpt: brandScore + 0.5,
    gemini: brandScore - 0.3,
    perplexity: brandScore + 0.2
  };

  const competitors = analysisData?.competitors || [
    { name: competitor1, score: competitor1 ? generateScore(competitor1, 7) : 0 },
    { name: competitor2, score: competitor2 ? generateScore(competitor2, 13) : 0 },
    { name: competitor3, score: competitor3 ? generateScore(competitor3, 19) : 0 }
  ].filter(c => c.name);

  const averageCompScore = competitors.length > 0 
    ? competitors.reduce((acc, c) => acc + c.score, 0) / competitors.length 
    : 0;

  const ranking = [
    { name: brandName, score: brandScore, isBrand: true },
    ...competitors.map(c => ({ ...c, isBrand: false }))
  ].sort((a, b) => b.score - a.score);

  const brandRank = ranking.findIndex(r => r.isBrand) + 1;

  return (
    <>
      <SEOHelmet
        title="Free AI Visibility Score Checker | Audit Your Brand in ChatGPT"
        description="Instant analysis. See how often AI models mention your brand vs. competitors. Get your free Llumos Score and actionable insights in under 2 minutes."
        keywords="AI visibility checker, ChatGPT audit, brand visibility score, free AI analysis, competitor comparison"
        canonicalPath="/free-checker"
        structuredData={[
          structuredDataGenerators.organization(),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Free AI Visibility Score Checker",
            description: "Check how often AI models mention your brand vs. competitors",
            url: "https://llumos.ai/free-checker"
          }
        ]}
      />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signin">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 text-center bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto max-w-4xl">
          <Badge className="mb-4 shadow-soft">
            <Star className="w-3 h-3 mr-1 inline fill-current" />
            Free AI Visibility Check - No Signup Required
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            See How Your Brand Ranks
            <span className="text-primary block mt-2">Against Competitors in AI Search</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Instantly discover how your brand's AI visibility compares to your competitors across ChatGPT, Gemini, and Perplexity.
          </p>

          <div className="flex justify-center items-center gap-6 text-sm text-muted-foreground mb-8">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              No signup required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              Instant results
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-primary" />
              Compare with competitors
            </span>
          </div>
        </div>
      </section>

      {/* Checker Form */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Get Your Free Visibility Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="brand" className="text-base">Your Brand Name *</Label>
                  <Input
                    id="brand"
                    placeholder="e.g., Acme Corp"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="domain" className="text-base">Your Website Domain *</Label>
                  <Input
                    id="domain"
                    type="url"
                    placeholder="e.g., acmecorp.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-base">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="industry" className="text-base">Industry *</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Label className="text-base mb-3 block">Add Competitors (Optional - up to 3)</Label>
                  <div className="space-y-3">
                    <Input
                      placeholder="Competitor 1"
                      value={competitor1}
                      onChange={(e) => setCompetitor1(e.target.value)}
                    />
                    <Input
                      placeholder="Competitor 2"
                      value={competitor2}
                      onChange={(e) => setCompetitor2(e.target.value)}
                    />
                    <Input
                      placeholder="Competitor 3"
                      value={competitor3}
                      onChange={(e) => setCompetitor3(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full"
                onClick={handleAnalyze}
                disabled={!brandName || !industry || !domain || !email || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Zap className="mr-2 h-5 w-5 animate-pulse" />
                    Analyzing AI Visibility...
                  </>
                ) : (
                  <>
                    Get Free Analysis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {showResults && (
        <section id="results" className="py-16 px-4 bg-muted/20">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">
                <BarChart3 className="w-3 h-3 mr-1 inline" />
                Sample Visibility Report
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Your AI Search Visibility Analysis
              </h2>
              <p className="text-muted-foreground">
                {analysisData ? `Analysis for ${brandName} in ${industry}` : `Based on simulated data for ${brandName} in ${industry}`}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Overall Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Your Visibility Score</span>
                    <Badge variant={brandScore >= 7 ? "default" : brandScore >= 5 ? "secondary" : "destructive"}>
                      {brandScore >= 7 ? "Good" : brandScore >= 5 ? "Fair" : "Needs Improvement"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-6">
                    <div className="text-6xl font-bold text-primary mb-2">{brandScore.toFixed(1)}</div>
                    <div className="text-2xl text-muted-foreground">/10</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ChatGPT</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${platformScores.chatgpt * 10}%` }}></div>
                        </div>
                        <span className="text-sm font-mono w-8">{platformScores.chatgpt.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Gemini</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-secondary" style={{ width: `${platformScores.gemini * 10}%` }}></div>
                        </div>
                        <span className="text-sm font-mono w-8">{platformScores.gemini.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Perplexity</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${platformScores.perplexity * 10}%` }}></div>
                        </div>
                        <span className="text-sm font-mono w-8">{platformScores.perplexity.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Competitive Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Competitive Ranking</span>
                    {brandRank === 1 ? (
                      <TrendingUp className="w-5 h-5 text-primary" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-6">
                    <div className="text-6xl font-bold mb-2">#{brandRank}</div>
                    <div className="text-sm text-muted-foreground">out of {ranking.length} {ranking.length === 1 ? 'brand' : 'brands'}</div>
                  </div>
                  <div className="space-y-2">
                    {ranking.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          item.isBrand ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg font-bold w-6">#{idx + 1}</span>
                          <span className={item.isBrand ? 'font-semibold' : ''}>{item.name}</span>
                          {item.isBrand && <Badge variant="outline" className="text-xs">You</Badge>}
                        </div>
                        <span className="font-mono font-bold">{item.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Insights */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      {brandScore >= averageCompScore ? (
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium mb-1">Competitive Position</p>
                        <p className="text-sm text-muted-foreground">
                          {brandScore >= averageCompScore 
                            ? `You're performing ${((brandScore / averageCompScore - 1) * 100).toFixed(0)}% better than competitors on average`
                            : `You're ${((1 - brandScore / averageCompScore) * 100).toFixed(0)}% behind competitor average`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">Visibility Coverage</p>
                        <p className="text-sm text-muted-foreground">
                          Estimated {Math.round(brandScore * 8)}% mention rate in industry-related AI queries
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">Optimization Potential</p>
                        <p className="text-sm text-muted-foreground">
                          {brandScore < 7 
                            ? `High potential to improve positioning across all AI platforms`
                            : `Opportunities to maintain leadership position`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Search className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">Platform Performance</p>
                        <p className="text-sm text-muted-foreground">
                          Strongest on ChatGPT, opportunity to improve on Gemini
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold mb-4">Want {analysisData ? 'Deeper' : 'to See Your REAL'} Insights?</h3>
                <p className="text-lg mb-6 opacity-90">
                  {analysisData 
                    ? 'Get continuous real-time monitoring, detailed recommendations, and competitor tracking to dominate AI search.'
                    : 'This is a simulated report. Get accurate, real-time visibility tracking with detailed recommendations to improve your AI search presence.'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" variant="secondary" asChild>
                    <Link to="/signup">
                      Start 7-Day Free Trial
                      <ArrowRight className="ml-2 h-5 h-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
                    <Link to="/pricing">View Pricing</Link>
                  </Button>
                </div>
                <p className="text-sm mt-4 opacity-75">
                  7-day free trial • Cancel anytime • Setup in 5 minutes
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Benefits Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Get the Full Picture with Llumos</h2>
            <p className="text-lg text-muted-foreground">
              Real-time monitoring, competitor analysis, and actionable recommendations
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-Time Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Monitor your brand across all major AI platforms 24/7 with automated daily updates
              </p>
            </Card>
            <Card className="text-center p-6">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Competitor Intelligence</h3>
              <p className="text-sm text-muted-foreground">
                Track up to 10 competitors and see exactly how they're positioning themselves
              </p>
            </Card>
            <Card className="text-center p-6">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Recommendations</h3>
              <p className="text-sm text-muted-foreground">
                Get specific, actionable steps to improve your visibility and ranking
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-muted/10">
        <div className="container mx-auto px-4 text-center">
          <Logo />
          <p className="text-sm text-muted-foreground mt-4 mb-6">
            AI search optimization platform for modern brands
          </p>
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}