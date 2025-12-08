import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Search, Loader2, Building2, Target, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Competitor {
  name: string;
  reason: string;
}

interface CompetitorResult {
  brandName: string;
  industry: string;
  competitors: Competitor[];
  domain: string;
}

export default function AICompetitorFinder() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompetitorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a website URL to analyze",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('public-competitor-lookup', {
        body: { url: url.trim() }
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        if (data.retryAfter) {
          setError(`${data.message}`);
        } else {
          setError(data.message || data.error);
        }
        return;
      }

      setResult(data);
      toast({
        title: "Analysis Complete",
        description: `Found ${data.competitors?.length || 0} competitors for ${data.brandName}`
      });

    } catch (err: any) {
      console.error('Competitor lookup error:', err);
      setError(err.message || 'Failed to analyze competitors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Free AI Competitor Finder - Discover Your Top Competitors"
        description="Enter your website URL and our AI will instantly identify your top 3 competitors in AI search results. Free tool by Llumos."
        canonicalUrl="/tools/ai-competitor-finder"
        ogImage="/og-home.png"
      />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Search className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold">Llumos</span>
            </Link>
            <nav className="flex items-center space-x-4">
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Button size="sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="py-16 md:py-24 px-4">
          <div className="container max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2 border-primary/20">
              Free Tool
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              AI Competitor Finder
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Enter your website and our AI will instantly identify your top 3 competitors in AI search results.
            </p>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter your website (e.g., acme.com)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10 h-12 text-base"
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" size="lg" disabled={isLoading} className="h-12 px-6">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Competitors
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Error State */}
            {error && (
              <Card className="mt-8 max-w-xl mx-auto border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-destructive">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                  {error.includes('once per day') && (
                    <Button asChild className="mt-4" variant="outline">
                      <Link to="/signup">
                        Sign Up for Unlimited Access
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {result && (
              <div className="mt-10 space-y-6">
                <div className="text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="secondary" className="text-sm">
                      {result.industry}
                    </Badge>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-semibold">{result.brandName}</span>
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-6">Your Top 3 Competitors</h2>
                  
                  <div className="grid gap-4">
                    {result.competitors.map((competitor, index) => (
                      <Card key={index} className="hover:border-primary/50 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-1">{competitor.name}</h3>
                              <p className="text-muted-foreground text-sm">{competitor.reason}</p>
                            </div>
                            <Target className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Card className="mt-8 bg-primary/5 border-primary/20">
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">Ready to Outrank Your Competitors?</CardTitle>
                    <CardDescription>
                      Track how often AI recommends you vs. these {result.competitors.length} competitors
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Button size="lg" asChild>
                      <Link to="/signup">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Compare My Rank Against These Brands
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Benefits when no result */}
            {!result && !error && (
              <div className="mt-16 space-y-12">
                <div className="grid md:grid-cols-3 gap-6 text-left">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        AI-Powered Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        Our AI analyzes your industry and identifies real competitors, not just similar websites.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Direct Competitors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        Get the top 3 brands competing for the same customers and AI visibility as you.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Track & Compare
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        Sign up to continuously track how AI recommends you vs. your competitors.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Free Tier CTA */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="text-center">
                    <Badge variant="secondary" className="mb-2 w-fit mx-auto">Forever Free</Badge>
                    <CardTitle className="text-2xl">Start Tracking for Free</CardTitle>
                    <CardDescription className="text-base">
                      Track 5 prompts weekly across ChatGPT with our Free plan. No credit card required.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>✓ 5 prompts tracked weekly</li>
                      <li>✓ ChatGPT visibility data</li>
                      <li>✓ Read-only dashboard access</li>
                      <li>✓ No credit card required</li>
                    </ul>
                    <Button size="lg" asChild>
                      <Link to="/signup">
                        Get Started Free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
