import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, Users, Zap, Target, TrendingUp } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';

export default function StarterPlan() {
  const features = [
    {
      icon: Users,
      title: 'Single User Account',
      description: 'Perfect for solo founders and small business owners managing their own brand'
    },
    {
      icon: Target,
      title: '25 Daily Prompts',
      description: 'Track 25 prompts per day across AI platforms to monitor your brand visibility'
    },
    {
      icon: Zap,
      title: '2 AI Platforms',
      description: 'Monitor ChatGPT and Perplexity AI - the two most popular AI search platforms'
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Tracking',
      description: 'Get instant updates on how AI platforms are representing your brand'
    }
  ];

  const useCases = [
    'Small businesses testing AI visibility',
    'Solo founders tracking brand mentions',
    'Startups beginning their AI SEO journey',
    'Companies with limited budgets'
  ];

  const limitations = [
    'Limited to 2 AI platforms (no Gemini or Google AI Overviews)',
    'Cannot track competitor mentions',
    'No AI-powered recommendations',
    'Email support only (no priority support)'
  ];

  return (
    <>
      <SEOHelmet
        title="Starter Plan - AI Search Visibility for Small Businesses"
        description="Start tracking your AI search visibility with our Starter plan. Monitor ChatGPT and Perplexity AI with 25 daily prompts. $39/month with 7-day free trial."
        keywords="starter plan, AI search tracking, ChatGPT monitoring, small business AI SEO"
        canonicalPath="/plans/starter"
      />
      <div className="min-h-screen bg-gradient-bg">
        {/* Header */}
        <header className="border-b border-border/30 bg-card/30 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Logo collapsed={false} />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link to="/pricing">
                <Button variant="outline">View All Plans</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <Badge className="mb-4">Starter Plan</Badge>
            <h1 className="text-5xl font-bold mb-4">Perfect for Getting Started</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Begin tracking your AI search visibility with essential features for small businesses and solo founders.
            </p>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-center">
                <div className="text-5xl font-bold">$39</div>
                <div className="text-muted-foreground">per month</div>
              </div>
              <div className="text-muted-foreground">or</div>
              <div className="text-center">
                <div className="text-5xl font-bold">$390</div>
                <div className="text-muted-foreground">per year</div>
                <Badge variant="secondary" className="mt-2">Save 17%</Badge>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-6">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>7-Day Free Trial:</strong> Full access with no charge until trial ends. Cancel anytime.
              </p>
            </div>
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Key Features */}
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">What's Included</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {/* Detailed Features List */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">All Starter Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>1 user account</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>25 prompts tracked daily</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>2 AI platforms (ChatGPT + Perplexity)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Real-time tracking</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Email support</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Brand catalog tracking</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Basic analytics dashboard</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Domain verification</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best For Section */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-12">
            <Card>
              <CardHeader>
                <CardTitle>Perfect For</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {useCases.map((useCase) => (
                    <li key={useCase} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limitations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-lg">•</span>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Path */}
          <div className="max-w-4xl mx-auto">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Ready to Scale?</CardTitle>
                <CardDescription>
                  As your business grows, upgrade to Growth or Pro for more platforms, competitor tracking, and AI-powered recommendations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/pricing">
                  <Button variant="outline">Compare All Plans</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
