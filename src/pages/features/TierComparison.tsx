import { Layout } from '@/components/Layout';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Zap, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TierComparison() {
  const features = [
    {
      category: "AI Platform Coverage",
      items: [
        { name: "ChatGPT (OpenAI)", starter: true, growth: true, pro: true },
        { name: "Claude (Anthropic)", starter: true, growth: true, pro: true },
        { name: "Perplexity", starter: false, growth: true, pro: true },
        { name: "Gemini (Google)", starter: false, growth: true, pro: true },
        { name: "All Platforms", starter: false, growth: false, pro: true }
      ]
    },
    {
      category: "Tracking & Monitoring",
      items: [
        { name: "Daily Prompt Tracking", starter: "25/day", growth: "100/day", pro: "300/day" },
        { name: "AI Providers per Prompt", starter: "2", growth: "4", pro: "4" },
        { name: "Historical Data Retention", starter: "30 days", growth: "90 days", pro: "Unlimited" },
        { name: "Real-time Monitoring", starter: true, growth: true, pro: true },
        { name: "Automated Daily Checks", starter: false, growth: true, pro: true }
      ]
    },
    {
      category: "Analytics & Insights",
      items: [
        { name: "Visibility Score Tracking", starter: true, growth: true, pro: true },
        { name: "Brand Presence Analytics", starter: true, growth: true, pro: true },
        { name: "Citation Analysis", starter: false, growth: true, pro: true },
        { name: "Citation Quality Metrics", starter: false, growth: false, pro: true },
        { name: "Competitive Intelligence", starter: false, growth: true, pro: true },
        { name: "Advanced Competitor Tracking", starter: false, growth: false, pro: true },
        { name: "Content Performance Insights", starter: false, growth: true, pro: true },
        { name: "Trend Analysis", starter: false, growth: true, pro: true }
      ]
    },
    {
      category: "Recommendations",
      items: [
        { name: "AI-Powered Content Suggestions", starter: false, growth: true, pro: true },
        { name: "Priority Recommendations", starter: false, growth: true, pro: true },
        { name: "Custom Optimization Strategies", starter: false, growth: false, pro: true },
        { name: "Prompt Suggestions", starter: true, growth: true, pro: true }
      ]
    },
    {
      category: "Reporting",
      items: [
        { name: "Weekly Reports", starter: false, growth: true, pro: true },
        { name: "Custom Report Builder", starter: false, growth: false, pro: true },
        { name: "PDF Export", starter: false, growth: true, pro: true },
        { name: "Report Templates", starter: false, growth: false, pro: true },
        { name: "Scheduled Reports", starter: false, growth: false, pro: true }
      ]
    },
    {
      category: "llms.txt Management",
      items: [
        { name: "llms.txt Generator", starter: true, growth: true, pro: true },
        { name: "Auto-Generation from Website", starter: false, growth: true, pro: true },
        { name: "Version History", starter: false, growth: false, pro: true },
        { name: "Multi-Site Management", starter: false, growth: false, pro: true }
      ]
    },
    {
      category: "Team & Collaboration",
      items: [
        { name: "Team Members", starter: "1", growth: "3", pro: "10" },
        { name: "Shared Dashboards", starter: false, growth: true, pro: true },
        { name: "Role-Based Access", starter: false, growth: false, pro: true },
        { name: "Activity Logs", starter: false, growth: false, pro: true },
        { name: "Multi-Brand Support", starter: false, growth: false, pro: true }
      ]
    },
    {
      category: "Integration & API",
      items: [
        { name: "API Access", starter: false, growth: false, pro: true },
        { name: "Webhook Support", starter: false, growth: false, pro: true },
        { name: "Custom Integrations", starter: false, growth: false, pro: true }
      ]
    },
    {
      category: "Support",
      items: [
        { name: "Email Support", starter: true, growth: true, pro: true },
        { name: "Priority Support", starter: false, growth: false, pro: true },
        { name: "Dedicated Account Manager", starter: false, growth: false, pro: true },
        { name: "Custom Onboarding", starter: false, growth: false, pro: true }
      ]
    }
  ];

  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-primary mx-auto" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground mx-auto" />
      );
    }
    return <span className="text-sm text-center block">{value}</span>;
  };

  return (
    <Layout>
      <SEOHelmet 
        title="Feature Comparison - Starter vs Growth vs Pro | Llumos"
        description="Compare Llumos pricing tiers in detail. See exactly what features are included in Starter, Growth, and Pro plans for AI search optimization."
      />
      
      <div className="space-y-12 pb-12">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Choose the Right Plan
            <span className="text-primary block mt-2">For Your Business</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Compare all features across our Starter, Growth, and Pro plans to find 
            the perfect fit for your AI visibility needs.
          </p>
        </section>

        {/* Quick Comparison Cards */}
        <section className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Starter</CardTitle>
                <CardDescription>Perfect for individuals and small businesses</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">$39</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link to="/pricing">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-primary">
              <CardHeader>
                <TrendingUp className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Growth</CardTitle>
                <CardDescription>For growing teams tracking multiple prompts</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">$99</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link to="/pricing">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Pro</CardTitle>
                <CardDescription>Enterprise-grade features for large teams</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">$199</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link to="/pricing">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Detailed Feature Comparison */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Detailed Feature Comparison</h2>
            <p className="text-muted-foreground">
              Every feature, every plan, side by side
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Feature</th>
                      <th className="text-center p-4 font-semibold w-32">Starter</th>
                      <th className="text-center p-4 font-semibold w-32 bg-primary/5">Growth</th>
                      <th className="text-center p-4 font-semibold w-32">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((category, catIndex) => (
                      <>
                        <tr key={`cat-${catIndex}`} className="bg-muted/50">
                          <td colSpan={4} className="p-4 font-semibold text-sm uppercase tracking-wide">
                            {category.category}
                          </td>
                        </tr>
                        {category.items.map((item, itemIndex) => (
                          <tr key={`item-${catIndex}-${itemIndex}`} className="border-b">
                            <td className="p-4 text-sm">{item.name}</td>
                            <td className="p-4">{renderValue(item.starter)}</td>
                            <td className="p-4 bg-primary/5">{renderValue(item.growth)}</td>
                            <td className="p-4">{renderValue(item.pro)}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="container max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. When upgrading, 
                  you'll get immediate access to new features. When downgrading, changes take 
                  effect at the end of your current billing period.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens if I exceed my daily prompt limit?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  If you reach your daily prompt limit, you can either wait until the next day 
                  or upgrade to a higher tier for more capacity. We'll send you a notification 
                  when you're approaching your limit.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer annual billing?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! Annual billing is available with a 20% discount. Contact our sales team 
                  for annual pricing options.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's included in the free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  All plans come with a 7-day free trial that gives you full access to all 
                  features of that tier. No credit card required to start.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="container max-w-4xl mx-auto text-center space-y-6 py-12">
          <h2 className="text-3xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground">
            Start your free 7-day trial today. No credit card required.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/signup">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
