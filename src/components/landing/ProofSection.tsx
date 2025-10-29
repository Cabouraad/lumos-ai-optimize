import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, TrendingUp, Award, PlayCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

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

          {/* Case Study */}
          <Card className="shadow-elevated hover-lift">
            <CardContent className="p-8">
              <Badge className="mb-4">Case Study</Badge>
              <h3 className="text-2xl font-bold mb-4">
                How DataCore Increased AI Visibility by 300% in 60 Days
              </h3>
              
              <div className="space-y-6">
                <div>
                  <p className="text-muted-foreground mb-4">
                    A B2B SaaS company struggling with low brand awareness in AI search results.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">The Challenge</p>
                      <p className="text-sm text-muted-foreground">
                        Brand mentioned in only 12% of relevant AI queries, losing to competitors
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">The Solution</p>
                      <p className="text-sm text-muted-foreground">
                        Implemented Llumos tracking + followed AI optimization recommendations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">The Results</p>
                      <p className="text-sm text-muted-foreground">
                        Now mentioned in 48% of queries, ranked #1 in their category
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-primary">300%</p>
                      <p className="text-xs text-muted-foreground">Visibility Increase</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-primary">60</p>
                      <p className="text-xs text-muted-foreground">Days to Results</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-primary">#1</p>
                      <p className="text-xs text-muted-foreground">Category Rank</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Testimonial Placeholder */}
        <Card className="max-w-3xl mx-auto shadow-elevated">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="relative w-full md:w-48 h-48 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <PlayCircle className="w-16 h-16 text-primary" />
                <Badge className="absolute top-3 right-3">2:34</Badge>
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-3">
                  "Llumos helped us dominate AI search in our category"
                </h3>
                <p className="text-muted-foreground mb-4">
                  Watch how Sarah Chen, CMO of TechFlow, transformed their AI visibility strategy and captured 3x more qualified leads through AI-powered search.
                </p>
                <Button variant="outline" asChild>
                  <Link to="/resources">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Watch Full Story
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Mentions */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-6">As featured in leading industry publications</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
            <div className="text-xl font-bold text-muted-foreground">TechCrunch</div>
            <div className="text-xl font-bold text-muted-foreground">VentureBeat</div>
            <div className="text-xl font-bold text-muted-foreground">Forbes</div>
            <div className="text-xl font-bold text-muted-foreground">MarTech</div>
            <div className="text-xl font-bold text-muted-foreground">Search Engine Journal</div>
          </div>
        </div>
      </div>
    </section>
  );
}