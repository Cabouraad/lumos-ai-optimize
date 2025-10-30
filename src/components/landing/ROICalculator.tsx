import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ROICalculator() {
  const [monthlyTraffic, setMonthlyTraffic] = useState<string>('10000');
  const [showResults, setShowResults] = useState(false);

  const traffic = parseInt(monthlyTraffic) || 0;
  
  // Calculations based on typical B2B metrics
  const aiSearchTraffic = Math.round(traffic * 0.15); // 15% of traffic now comes from AI search
  const invisibleTraffic = Math.round(aiSearchTraffic * 0.73); // 73% of AI traffic is invisible without optimization
  const avgLeadValue = 250; // Average B2B lead value
  const conversionRate = 0.02; // 2% conversion rate
  const missedLeads = Math.round(invisibleTraffic * conversionRate);
  const monthlyLoss = Math.round(missedLeads * avgLeadValue);
  const yearlyLoss = monthlyLoss * 12;

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowResults(true);
  };

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Calculate Your Lost Revenue
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how much potential revenue you're losing by being invisible in AI search results
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Calculator Input */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-xl">Enter Your Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCalculate} className="space-y-6">
                <div>
                  <Label htmlFor="traffic" className="text-base">
                    Monthly Website Traffic
                  </Label>
                  <Input
                    id="traffic"
                    type="number"
                    min="0"
                    step="1000"
                    value={monthlyTraffic}
                    onChange={(e) => setMonthlyTraffic(e.target.value)}
                    placeholder="e.g., 10000"
                    className="mt-2 text-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter your average monthly website visitors
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full">
                  Calculate Lost Revenue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>

              {/* Quick stats */}
              <div className="mt-6 pt-6 border-t space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Industry Average</span>
                  <span className="font-semibold">15% AI search traffic</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Visibility Gap</span>
                  <span className="font-semibold">73% brands invisible</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg. Conversion</span>
                  <span className="font-semibold">2% for B2B</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            <Card className="bg-destructive/5 border-destructive/20 shadow-elevated">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Estimated Annual Loss</p>
                    {showResults ? (
                      <>
                        <p className="text-4xl font-bold text-destructive">
                          ${yearlyLoss.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          ${monthlyLoss.toLocaleString()}/month in missed opportunities
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-4xl font-bold text-muted-foreground/50">
                          $—
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Enter your traffic to calculate
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Impact Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">
                      {showResults ? `${invisibleTraffic.toLocaleString()} visitors` : '— visitors'}
                    </p>
                    <p className="text-sm text-muted-foreground">Can't find you in AI search</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">
                      {showResults ? `${missedLeads} potential leads` : '— potential leads'}
                    </p>
                    <p className="text-sm text-muted-foreground">Lost per month</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">${avgLeadValue} per lead</p>
                    <p className="text-sm text-muted-foreground">Average B2B value</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showResults && (
              <Card className="bg-primary text-primary-foreground shadow-elevated">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-bold mb-2">Ready to Capture This Revenue?</h3>
                  <p className="text-sm mb-4 opacity-90">
                    Track and optimize your AI search visibility to stop losing customers
                  </p>
                  <Button variant="secondary" size="lg" asChild className="w-full">
                    <Link to="/auth">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}