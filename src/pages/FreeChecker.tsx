import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { 
  Search, 
  BarChart3, 
  Mail, 
  CheckCircle, 
  ArrowRight, 
  Star,
  TrendingUp,
  Shield,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function FreeChecker() {
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !domain) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and domain.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call edge function to process the request
      const { data, error } = await supabase.functions.invoke('free-visibility-checker', {
        body: { email, domain }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Analysis Started!",
        description: "We're analyzing your brand visibility across AI platforms. Results will be emailed to you within 5 minutes.",
        duration: 6000
      });

      // Reset form
      setEmail('');
      setDomain('');
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button variant="outline" asChild>
            <a href="/dashboard">Dashboard</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <Badge variant="secondary" className="mb-6">
            Free AI Visibility Check
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 gradient-primary bg-clip-text text-transparent">
            See How Your Brand Appears in AI Search Results
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get instant insights into your brand's visibility across ChatGPT, Gemini, Perplexity, and Claude. 
            See what your customers find when they ask AI about your industry.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => document.getElementById('checker-form')?.scrollIntoView()}>
              Get Free Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-sm text-muted-foreground">
              ✓ No credit card required • ✓ Instant analysis
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex justify-center items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span>4.9/5 rating</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>10,000+ brands analyzed</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Enterprise secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our AI-powered analysis runs your brand through multiple scenarios to give you actionable insights
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">1. AI Query Analysis</h3>
              <p className="text-muted-foreground">
                We run 5 industry-specific prompts across ChatGPT, Gemini, Perplexity, and Claude
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">2. Visibility Scoring</h3>
              <p className="text-muted-foreground">
                Our algorithm analyzes mentions, positioning, and competitive landscape
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">3. Instant Report</h3>
              <p className="text-muted-foreground">
                Get a detailed visibility snapshot delivered to your inbox in minutes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Results Preview */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              What You'll Discover
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sample insights from our AI visibility analysis
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-display font-bold mb-4">
                    AI Visibility Score
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary"></div>
                        ChatGPT
                      </span>
                      <span className="font-mono font-bold">8.2/10</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary"></div>
                        Gemini
                      </span>
                      <span className="font-mono font-bold">6.7/10</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-accent"></div>
                        Perplexity
                      </span>
                      <span className="font-mono font-bold">7.4/10</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                        Claude
                      </span>
                      <span className="font-mono font-bold">5.9/10</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-3">Key Insights</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-secondary mt-0.5" />
                      <p className="text-sm">Your brand appears in 73% of industry-related queries</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                      <p className="text-sm">Ranked #2 most mentioned in your category</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-accent mt-0.5" />
                      <p className="text-sm">Opportunity to improve positioning in AI responses</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Lead Capture Form */}
      <section id="checker-form" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Get Your Free AI Visibility Report
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Enter your details below and we'll analyze your brand across all major AI platforms
            </p>

            <Card className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Business Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="domain" className="block text-sm font-medium mb-2">
                      Company Domain
                    </label>
                    <Input
                      id="domain"
                      type="text"
                      placeholder="company.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Zap className="mr-2 h-4 w-4 animate-spin" />
                      Running Analysis...
                    </>
                  ) : (
                    <>
                      Get Free Analysis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  By submitting, you agree to receive your free report and occasional updates about AI search optimization. 
                  No spam, unsubscribe anytime.
                </p>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Brands Use Llumos */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Why 10,000+ Brands Trust Llumos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The complete AI search optimization platform for modern brands
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Monitoring</h3>
              <p className="text-muted-foreground text-sm">
                Track your brand mentions across all AI platforms 24/7
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Competitive Intelligence</h3>
              <p className="text-muted-foreground text-sm">
                See how you stack up against competitors in AI responses
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Actionable Insights</h3>
              <p className="text-muted-foreground text-sm">
                Get specific recommendations to improve AI visibility
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Weekly Reports</h3>
              <p className="text-muted-foreground text-sm">
                Automated insights delivered to your inbox every week
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Enterprise Security</h3>
              <p className="text-muted-foreground text-sm">
                SOC 2 compliant with enterprise-grade data protection
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Expert Support</h3>
              <p className="text-muted-foreground text-sm">
                Dedicated AI search optimization specialists
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" variant="outline" asChild>
              <a href="/pricing">
                View Full Platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo />
              <p className="text-sm text-muted-foreground mt-4">
                AI search optimization platform for modern brands
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/about" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="/resources" className="hover:text-foreground transition-colors">Resources</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="/security" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              © 2024 Llumos. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Disclaimer: Results are estimates based on AI platform analysis. Individual results may vary. 
              This free analysis provides a sample of our full platform capabilities.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}