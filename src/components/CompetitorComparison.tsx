import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CompetitorComparison() {
  return (
    <section className="py-20 px-4 bg-muted/10">
      <div className="container max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mx-auto w-fit px-4 py-2 mb-4 border-primary/20">
            <Sparkles className="w-4 h-4 mr-2 inline-block" />
            Pricing Comparison
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Llumos Beats Enterprise AI Search Tools
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get enterprise-level AI visibility tracking at a fraction of the cost
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Profound AI */}
          <Card className="relative border-2">
            <CardHeader>
              <CardTitle className="text-xl">Profound AI</CardTitle>
              <div className="text-3xl font-bold mt-2">$500–$1,200<span className="text-base font-normal text-muted-foreground">/mo</span></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">Enterprise-only features</span>
              </div>
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">Long onboarding process</span>
              </div>
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">Locked behind expensive seats</span>
              </div>
            </CardContent>
          </Card>

          {/* Conductor AI */}
          <Card className="relative border-2">
            <CardHeader>
              <CardTitle className="text-xl">Conductor AI</CardTitle>
              <div className="text-3xl font-bold mt-2">$600+<span className="text-base font-normal text-muted-foreground">/mo</span></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">Requires large SEO team</span>
              </div>
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">Complex dashboards</span>
              </div>
              <div className="flex items-start gap-2">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm">High learning curve</span>
              </div>
            </CardContent>
          </Card>

          {/* Llumos - Highlighted */}
          <Card className="relative border-4 border-primary shadow-glow bg-gradient-to-br from-primary/5 to-background">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-6 py-1 text-sm font-semibold">
                Best Value
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-xl text-primary">Llumos</CardTitle>
              <div className="text-3xl font-bold mt-2">
                $39<span className="text-base font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-primary font-semibold">
                or $99/year (Black Friday)
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">Built for marketers, founders, and agencies</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">Fast setup, automated daily AI checks</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">See how often AI recommends your brand and competitors</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-10">
          <Button size="lg" className="px-8 h-12 shadow-glow" asChild>
            <Link to="/demo">Watch The Demo</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-3">See what Llumos can do for your brand</p>
        </div>
      </div>
    </section>
  );
}
