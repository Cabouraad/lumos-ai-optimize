import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, Users, Zap, Target, TrendingUp, LineChart, Sparkles, Crown, Shield, Briefcase } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';

export default function ProPlan() {
  const features = [
    {
      icon: Users,
      title: 'Up to 10 Team Members',
      description: 'Full team access for large organizations and agencies'
    },
    {
      icon: Target,
      title: '300 Daily Prompts',
      description: 'Enterprise-level tracking for comprehensive brand monitoring'
    },
    {
      icon: Zap,
      title: 'All 4 AI Platforms',
      description: 'Complete coverage across ChatGPT, Perplexity, Gemini, and Google AIO'
    },
    {
      icon: LineChart,
      title: 'Track 10 Competitors',
      description: 'Deep competitive analysis across your entire market landscape'
    },
    {
      icon: Sparkles,
      title: 'Custom Optimization Plans',
      description: 'Tailored strategies for your specific industry and goals'
    },
    {
      icon: Crown,
      title: 'Dedicated Account Manager',
      description: 'Personal support and strategic guidance for your success'
    },
    {
      icon: Shield,
      title: 'White-Label Reports',
      description: 'Branded reports perfect for agencies and enterprise teams'
    },
    {
      icon: Briefcase,
      title: 'Multi-Brand Management',
      description: 'Track multiple brands and domains from a single dashboard'
    }
  ];

  const useCases = [
    'Large enterprises with multiple brands',
    'Digital marketing agencies serving clients',
    'Companies with 10+ competitors',
    'Organizations requiring white-label reporting',
    'Businesses needing dedicated support',
    'Multi-brand portfolio management'
  ];

  const enterpriseFeatures = [
    'Priority feature requests',
    'Custom integration support',
    'Advanced API access',
    'Dedicated Slack channel',
    'Quarterly strategy reviews',
    'Custom data retention policies',
    'SLA guarantees',
    'Custom training sessions'
  ];

  return (
    <>
      <SEOHelmet
        title="Pro Plan - Enterprise AI Search Visibility Solution"
        description="Enterprise-grade AI visibility tracking with 300 daily prompts, 10 team members, white-label reports, and dedicated support. $250/month for comprehensive brand management."
        keywords="enterprise AI tracking, white-label reports, multi-brand management, dedicated support, AI SEO enterprise"
        canonicalPath="/plans/pro"
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
            <Badge className="mb-4 bg-gradient-to-r from-primary to-primary/60">
              <Crown className="w-3 h-3 mr-1" /> Enterprise
            </Badge>
            <h1 className="text-5xl font-bold mb-4">Enterprise-Grade AI Visibility</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Complete AI search visibility solution for enterprises and agencies managing multiple brands at scale.
            </p>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-center">
                <div className="text-5xl font-bold">$250</div>
                <div className="text-muted-foreground">per month</div>
              </div>
              <div className="text-muted-foreground">or</div>
              <div className="text-center">
                <div className="text-5xl font-bold">$2,500</div>
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
          <div className="max-w-6xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">Enterprise Features</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} className="border-primary/30 bg-card/50">
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-sm">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {/* Detailed Features List */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Complete Pro Feature Set</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Up to 10 user accounts</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>300 prompts tracked daily</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>All 4 AI platforms</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Track 10 competitors</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Custom optimization plans</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Dedicated account manager</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>White-label reports</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Multi-brand management</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Priority support (24/7)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Advanced API access</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Custom data exports</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span>Quarterly strategy reviews</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enterprise Support */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Dedicated Enterprise Support</CardTitle>
                <CardDescription>
                  Get personalized support and strategic guidance tailored to your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {enterpriseFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
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
                      <span className="text-lg">{useCase}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Comparison CTA */}
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Not Sure Which Plan is Right?</CardTitle>
                <CardDescription>
                  Compare all plans side-by-side to find the perfect fit for your needs.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Link to="/pricing">
                  <Button variant="outline">Compare All Plans</Button>
                </Link>
                <Link to="/signup">
                  <Button>Start Pro Trial</Button>
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
