import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, TrendingUp, Award } from 'lucide-react';

export function ProofSection() {
  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge className="mb-4">Proven Results</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Real Companies. Real Results.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how leading brands transformed their AI search visibility
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
              <div className="p-4 bg-muted/30">
                <p className="text-sm text-center text-muted-foreground">
                  Real-time tracking across all major AI platforms
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Llumos Score Explanation */}
          <Card className="shadow-elevated hover-lift">
            <CardContent className="p-8">
              <Badge className="mb-4">How It Works</Badge>
              <h3 className="text-2xl font-bold mb-4">
                Understanding Your Llumos Score
              </h3>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Your Llumos Score is a comprehensive metric (0-10) that measures how effectively your brand appears in AI search results across all major platforms.
                </p>

                {/* Score Visualization */}
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-6">
                  <div className="flex items-center justify-center mb-6">
                    <div className="relative">
                      <svg width="160" height="160" viewBox="0 0 160 160">
                        {/* Background circle */}
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-muted/20"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeDasharray={`${2 * Math.PI * 70}`}
                          strokeDashoffset={`${2 * Math.PI * 70 * (1 - 0.84)}`}
                          strokeLinecap="round"
                          className="text-primary"
                          transform="rotate(-90 80 80)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary">8.4</div>
                          <div className="text-xs text-muted-foreground">Overall Score</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-background/80 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="font-semibold">High Score (8-10)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Excellent visibility across AI platforms</p>
                    </div>
                    <div className="bg-background/80 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-secondary"></div>
                        <span className="font-semibold">Mid Score (5-7)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Good presence with room to grow</p>
                    </div>
                    <div className="bg-background/80 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                        <span className="font-semibold">Low Score (0-4)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Needs optimization urgently</p>
                    </div>
                    <div className="bg-background/80 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                        <span className="font-semibold">Tracking</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Updated daily with trend analysis</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">Weighted Algorithm</p>
                      <p className="text-sm text-muted-foreground">
                        Combines mention frequency, ranking position, and sentiment across all platforms
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">Daily Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Track your score changes over time and identify what's working
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">Competitive Context</p>
                      <p className="text-sm text-muted-foreground">
                        See how your score compares to competitors in your category
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}