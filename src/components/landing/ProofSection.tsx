import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Award, BarChart3, ArrowRight, Bell, Target, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProofSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge className="mb-4">Get Your Score Now</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Where Does Your Brand Rank in AI Search?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover your Llumos Score and see how you stack up against competitors in ChatGPT, Gemini, and Perplexity
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Dashboard Preview */}
          <Card className="overflow-hidden shadow-elevated hover-lift">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-8">
                <div className="bg-background rounded-lg shadow-soft p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">AI Visibility Dashboard</h3>
                    <Badge variant="secondary">Live Data</Badge>
                  </div>
                  
                  {/* Mock Dashboard Elements */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">Overall Score</p>
                          <p className="text-xs text-muted-foreground">vs. last month</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">8.4</p>
                        <p className="text-xs text-primary">+23%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/50 rounded p-3 text-center">
                        <p className="text-sm font-semibold">ChatGPT</p>
                        <p className="text-xl font-bold text-primary">8.7</p>
                      </div>
                      <div className="bg-muted/50 rounded p-3 text-center">
                        <p className="text-sm font-semibold">Gemini</p>
                        <p className="text-xl font-bold text-secondary">7.9</p>
                      </div>
                      <div className="bg-muted/50 rounded p-3 text-center">
                        <p className="text-sm font-semibold">Perplexity</p>
                        <p className="text-xl font-bold text-accent">8.6</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Competitor Rank</span>
                      <span className="font-semibold">#2 of 8</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional Feature Highlights */}
              <div className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Historical Trends</p>
                    <p className="text-xs text-muted-foreground">Track your score changes over time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Competitor Analysis</p>
                    <p className="text-xs text-muted-foreground">See where you rank vs competitors</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Citation Tracking</p>
                    <p className="text-xs text-muted-foreground">Monitor every mention across AI platforms</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Smart Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified when your ranking changes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Actionable Insights</p>
                    <p className="text-xs text-muted-foreground">Get specific recommendations to improve your score</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30">
                <p className="text-sm text-center text-muted-foreground">
                  Real-time tracking across all major AI platforms
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CTA Card with Score */}
          <Card className="shadow-elevated hover-lift relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
            <CardContent className="p-8 relative">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-3">
                  Your Llumos Score Awaits
                </h3>
                <p className="text-muted-foreground mb-6">
                  Join brands already dominating AI search results
                </p>
              </div>

              {/* Score Visualization */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-8 mb-6">
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      {/* Background circle */}
                      <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-muted/20"
                      />
                      {/* Progress circle with animation suggestion */}
                      <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 60}`}
                        strokeDashoffset={`${2 * Math.PI * 60 * (1 - 0.84)}`}
                        strokeLinecap="round"
                        className="text-primary"
                        transform="rotate(-90 70 70)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-primary mb-1">?</div>
                        <div className="text-xs text-muted-foreground">Your Score</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">?</div>
                    <div className="text-xs text-muted-foreground">ChatGPT</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-secondary">?</div>
                    <div className="text-xs text-muted-foreground">Gemini</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-accent">?</div>
                    <div className="text-xs text-muted-foreground">Perplexity</div>
                  </div>
                </div>
              </div>

              {/* Benefits List */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm">Track visibility across all major AI platforms</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm">See your competitive ranking instantly</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm">Get actionable insights to improve your score</p>
                </div>
              </div>

              {/* CTA Button */}
              <Button 
                onClick={() => navigate('/auth')} 
                className="w-full" 
                size="lg"
              >
                Get Your Free Llumos Score
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                No credit card required • Takes less than 2 minutes
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}