import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, Users, Zap, Target, TrendingUp, LineChart, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';

export default function GrowthPlan() {
  const features = [
    {
      icon: Users,
      title: 'Up to 3 Team Members',
      description: 'Collaborate with your team to monitor and optimize AI visibility together'
    },
    {
      icon: Target,
      title: '100 Daily Prompts',
      description: 'Track 4x more prompts to get comprehensive coverage of your brand mentions'
    },
    {
      icon: Zap,
      title: 'All 4 AI Platforms',
      description: 'Monitor ChatGPT, Perplexity, Gemini, and Google AI Overviews'
    },
    {
      icon: LineChart,
      title: 'Track 3 Competitors',
      description: 'See how your brand compares to competitors across all AI platforms'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Recommendations',
      description: 'Get actionable insights to improve your AI search visibility'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Access detailed reports, trends, and export capabilities'
    }
  ];

  const useCases = [
    'Growing companies needing deeper insights',
    'Marketing teams tracking brand visibility',
    'Agencies managing client AI presence',
    'Companies with active competitors',
    'Businesses optimizing AI SEO strategy'
  ];

  const upgradesFromStarter = [
    '4x more daily prompts (100 vs 25)',
    '2 additional AI platforms (Gemini + Google AIO)',
    'Competitor tracking (up to 3 competitors)',
    'AI-powered optimization recommendations',
    '2 additional team members (3 total)',
    'Priority email support',
    'Advanced reporting and exports'
  ];

  return (
    <>
      <SEOHelmet
        title="Growth Plan - Advanced AI Search Visibility Tracking"
        description="Scale your AI visibility with our Growth plan. Monitor all 4 AI platforms, track competitors, and get AI-powered recommendations. $89/month with full team access."
        keywords="growth plan, AI search optimization, competitor tracking, team collaboration, AI SEO"
        canonicalPath="/plans/growth"
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
            <Badge className="mb-4 bg-primary">Most Popular</Badge>
            <h1 className="text-5xl font-bold mb-4">Grow Your AI Visibility</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Advanced features for growing companies that need comprehensive AI search tracking and competitor insights.
            </p>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-center">
                <div className="text-5xl font-bold">$89</div>
                <div className="text-muted-foreground">per month</div>
              </div>
              <div className="text-muted-foreground">or</div>
              <div className="text-center">
                <div className="text-5xl font-bold">$890</div>
                <div className="text-muted-foreground">per year</div>
                <Badge variant="secondary" className="mt-2">Save 17%</Badge>
              </div>
            </div>
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Key Features */}
          <div className="max-w-5xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">Everything in Growth</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} className="border-primary/20">
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
                <CardTitle className="text-2xl">All Growth Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Up to 3 user accounts</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>100 prompts tracked daily</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>All 4 AI platforms</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Track 3 competitors</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>AI-powered recommendations</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Advanced reporting & exports</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Historical data tracking</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Trend analysis</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Custom alerts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade from Starter */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Upgrade from Starter</CardTitle>
                <CardDescription>
                  See how Growth compares to the Starter plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {upgradesFromStarter.map((upgrade) => (
                    <li key={upgrade} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{upgrade}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Best For Section */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Perfect For</CardTitle>
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
          </div>

          {/* Next Level */}
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Need Enterprise Features?</CardTitle>
                <CardDescription>
                  Upgrade to Pro for 10 user accounts, 300 daily prompts, 10 competitor slots, and white-label reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/plans/pro">
                  <Button>View Pro Plan</Button>
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
