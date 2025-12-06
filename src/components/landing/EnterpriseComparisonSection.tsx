import { DollarSign, Zap, FileText, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const reasons = [
  {
    icon: DollarSign,
    title: 'The "Enterprise Tax" vs. Fair Pricing',
    oldWay: 'You pay for the logo. Enterprise tools lock high-value features behind $500/month starting prices and require annual contracts. You pay for "seats" you don\'t use and onboarding sessions you don\'t need.',
    llumosWay: 'You pay for the data. At $39/month, Llumos gives you the same raw visibility metrics—ranking, sentiment, and citations—without the fluff. We invested in compute, not a sales team.',
    metric: 'Save ~$5,000/year per client account.'
  },
  {
    icon: Zap,
    title: 'Gatekeepers vs. Instant Access',
    oldWay: 'Want to track a keyword? Schedule a demo. Wait 3 days for a sales rep. Sign an insertion order. Wait for provisioning.',
    llumosWay: 'Type in your URL. Click "Scan." See results in 30 seconds. Llumos is built for the modern "Product-Led" era. If you need to track a new client right before a pitch meeting, you can do it now, not next week.',
    metric: null
  },
  {
    icon: FileText,
    title: 'Built for Reporting, Not Just Monitoring',
    oldWay: 'Enterprise dashboards are complex and designed for in-house SEO teams to stare at all day. They are hard to export and hard to explain to a non-technical CMO.',
    llumosWay: 'We built Llumos to help you sell. Our White-Label Agency Reports turn complex AI data into a simple "Win/Loss" PDF. Show your clients exactly how ChatGPT perceives their brand vs. their competitors, with your agency\'s logo at the top.',
    metric: null
  }
];

const comparisonData = [
  { feature: 'Setup Time', llumos: '< 2 Minutes (Self-Serve)', competitor: 'Days/Weeks (Sales-Led)', llumosCheck: true },
  { feature: 'Contracts', llumos: 'Monthly / Cancel Anytime', competitor: 'Annual Contracts', llumosCheck: true },
  { feature: 'AI Models', llumos: 'ChatGPT, Gemini, Perplexity, Claude', competitor: 'Varies by tier', llumosCheck: true },
  { feature: 'Reporting', llumos: 'White-Label PDF (Agency Ready)', competitor: 'Complex Dashboards', llumosCheck: true },
  { feature: 'User Seats', llumos: 'Unlimited', competitor: 'Per-Seat Pricing', llumosCheck: true },
];

const EnterpriseComparisonSection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Enterprise Alternative
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Why Smart Agencies Are Switching from Profound AI to Llumos
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stop paying the "Enterprise Tax." Get the same AI visibility data for 1/10th of the cost.
          </p>
        </div>

        {/* 3 Reason Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {reasons.map((reason, index) => (
            <Card key={index} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <reason.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-4">{reason.title}</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive" />
                      The Old Way:
                    </p>
                    <p className="text-sm text-muted-foreground">{reason.oldWay}</p>
                  </div>
                  
                  <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                    <p className="text-sm font-medium text-primary mb-1 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      The Llumos Way:
                    </p>
                    <p className="text-sm text-foreground font-medium">{reason.llumosWay}</p>
                  </div>

                  {reason.metric && (
                    <div className="bg-accent/50 rounded-lg px-3 py-2">
                      <p className="text-sm font-semibold text-accent-foreground">{reason.metric}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-center text-foreground mb-8">
            Feature-by-Feature Comparison
          </h3>
          <div className="overflow-x-auto pt-6">
            <table className="w-full max-w-4xl mx-auto">
              <thead>
                <tr>
                  <th className="text-left p-4 text-muted-foreground font-medium">Feature</th>
                  <th className="p-4 text-center bg-primary/10 rounded-t-lg relative">
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Best Value
                    </Badge>
                    <span className="font-bold text-foreground">Llumos</span>
                    <span className="block text-sm text-primary font-semibold">$39/mo</span>
                  </th>
                  <th className="p-4 text-center">
                    <span className="font-bold text-foreground">Enterprise Tools</span>
                    <span className="block text-sm text-muted-foreground">$500+/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="p-4 text-foreground font-medium">{row.feature}</td>
                    <td className="p-4 text-center bg-primary/5">
                      <div className="flex items-center justify-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <span className="text-sm text-foreground">{row.llumos}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <X className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{row.competitor}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-8 md:p-12 text-center border border-primary/20">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            See why 500+ marketers made the switch.
          </h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Join agencies and growth teams who stopped paying the enterprise tax.
          </p>
          <Button asChild size="lg" className="px-8">
            <Link to="/signup">
              Compare Your First Brand for Free
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseComparisonSection;
