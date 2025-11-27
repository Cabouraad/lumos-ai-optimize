import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const COMPARISON_DATA = [
  {
    category: 'AI Platform Coverage',
    yourBrand: { value: 'Unknown', icon: XCircle, color: 'text-destructive' },
    competitors: { value: '85% mention rate', icon: CheckCircle, color: 'text-primary' }
  },
  {
    category: 'ChatGPT Visibility',
    yourBrand: { value: 'Not tracked', icon: XCircle, color: 'text-destructive' },
    competitors: { value: 'Rank #2 in queries', icon: TrendingUp, color: 'text-primary' }
  },
  {
    category: 'Gemini Presence',
    yourBrand: { value: 'Not monitored', icon: XCircle, color: 'text-destructive' },
    competitors: { value: 'Mentioned in 72%', icon: CheckCircle, color: 'text-primary' }
  },
  {
    category: 'Perplexity Ranking',
    yourBrand: { value: 'Unknown', icon: XCircle, color: 'text-destructive' },
    competitors: { value: 'Top 3 brand', icon: TrendingUp, color: 'text-primary' }
  },
  {
    category: 'Recommendation Rate',
    yourBrand: { value: 'No data', icon: XCircle, color: 'text-destructive' },
    competitors: { value: '68% of the time', icon: CheckCircle, color: 'text-primary' }
  }
];

export function ComparisonTable() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <Badge className="mb-4">Competitive Analysis</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your Competitors Are Already Winning in AI Search
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            While you're in the dark, your competitors are actively tracking and optimizing their AI visibility
          </p>
        </div>

        <Card className="shadow-elevated mb-8">
          <CardHeader className="bg-muted/30">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div></div>
              <div className="text-center">
                <CardTitle className="text-lg">Your Brand</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Without Tracking</p>
              </div>
              <div className="text-center">
                <CardTitle className="text-lg">Your Competitors</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">With AI Optimization</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {COMPARISON_DATA.map((row, idx) => (
              <div 
                key={idx} 
                className={`grid grid-cols-3 gap-4 p-6 items-center ${
                  idx !== COMPARISON_DATA.length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="font-medium text-sm md:text-base">{row.category}</div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <row.yourBrand.icon className={`w-5 h-5 ${row.yourBrand.color}`} />
                    <span className="text-sm text-muted-foreground">{row.yourBrand.value}</span>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <row.competitors.icon className={`w-5 h-5 ${row.competitors.color}`} />
                    <span className="text-sm font-semibold">{row.competitors.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stats Bar */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-destructive mb-2">73%</div>
              <p className="text-sm text-muted-foreground">
                Of B2B buyers use AI for research before contacting brands
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">47%</div>
              <p className="text-sm text-muted-foreground">
                Average visibility increase for optimized brands
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-secondary mb-2">5.2x</div>
              <p className="text-sm text-muted-foreground">
                More mentions than competitors who don't track AI visibility
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-3">See YOUR Brand's Real AI Visibility Scores</h3>
            <p className="text-lg mb-6 opacity-90 max-w-2xl mx-auto">
              Stop guessing. Start tracking. Get instant insights into how your brand compares to competitors across all major AI platforms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/free-checker">
                  Get Free Report
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                asChild
              >
                <Link to="/demo">Watch The Demo</Link>
              </Button>
            </div>
            <p className="text-sm mt-4 opacity-80">
              See what Llumos can do for your brand
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}