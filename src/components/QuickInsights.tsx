import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { CompetitorChip } from './CompetitorChip';

interface QuickInsightsProps {
  topBrands?: Array<{ name: string; mentions: number }>;
  topCompetitors?: Array<{ name: string; mentions: number }>;
  trendData?: Array<{ date: string; score: number }>;
  isOpen: boolean;
  onToggle: () => void;
}

export function QuickInsights({ 
  topBrands = [], 
  topCompetitors = [], 
  trendData = [],
  isOpen,
  onToggle 
}: QuickInsightsProps) {
  // Only show chart if we have real trend data
  const hasRealTrendData = trendData.length > 0;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground p-3 rounded-l-xl shadow-lg hover:bg-primary-hover transition-colors z-10"
      >
        <TrendingUp className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-background border-l shadow-soft-lg overflow-y-auto z-10">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Insights</h2>
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Top Brands */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              Top Brands (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topBrands.length > 0 ? (
              topBrands.slice(0, 3).map((brand, index) => (
                <div key={brand.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-warning' : index === 1 ? 'bg-chart-2' : 'bg-chart-3'
                    }`} />
                    <span className="text-sm font-medium">{brand.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {brand.mentions}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No brand mentions yet</div>
            )}
          </CardContent>
        </Card>

        {/* Top Competitors */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-chart-2" />
              Trending Competitors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCompetitors.length > 0 ? (
              <div className="space-y-2">
                {topCompetitors.slice(0, 3).map((competitor, index) => (
                  <div key={competitor.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-chart-2' : index === 1 ? 'bg-chart-3' : 'bg-chart-4'
                      }`} />
                      <CompetitorChip
                        name={competitor.name}
                        mentions={competitor.mentions}
                        size="sm"
                        variant="outline"
                        showLogo={true}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {competitor.mentions}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">No competitors found</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mini Trend Chart - Only show if we have real data */}
        {hasRealTrendData ? (
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                7-Day Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-center">
                <div className="text-xs text-muted-foreground">Real trend data available</div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                7-Day Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground">
                  No trend data available yet
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Run some prompts to see trends
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}