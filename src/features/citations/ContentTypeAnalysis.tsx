import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, TrendingUp } from 'lucide-react';

interface ContentTypeAnalysisProps {
  days: number;
  brandId?: string | null;
}

interface ContentTypeData {
  content_category: string;
  total_citations: number;
  avg_brand_visibility: number;
  unique_domains: number;
  own_content_count: number;
  competitor_content_count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

export function ContentTypeAnalysis({ days, brandId }: ContentTypeAnalysisProps) {
  const { data: contentTypes, isLoading } = useQuery({
    queryKey: ['content-type-performance', days, brandId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_content_type_performance', {
        p_days: days,
        p_brand_id: brandId || null,
      } as any);

      if (error) throw error;
      return data as ContentTypeData[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!contentTypes || contentTypes.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No content type data available for the selected time period.
        </AlertDescription>
      </Alert>
    );
  }

  // Find best performing content type for your domain
  const ownContentTypes = contentTypes
    .filter(ct => Number(ct.own_content_count) > 0)
    .sort((a, b) => Number(b.avg_brand_visibility) - Number(a.avg_brand_visibility));

  const topOwnContentType = ownContentTypes[0];

  // Find opportunities (competitor content types with high visibility)
  const opportunities = contentTypes
    .filter(ct => Number(ct.competitor_content_count) > Number(ct.own_content_count))
    .sort((a, b) => Number(b.avg_brand_visibility) - Number(a.avg_brand_visibility))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Insights */}
      {topOwnContentType && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Content Strategy Insight</AlertTitle>
          <AlertDescription>
            Your <strong>{topOwnContentType.content_category}</strong> content performs best with an average visibility score of{' '}
            <strong>{Number(topOwnContentType.avg_brand_visibility).toFixed(1)}/10</strong> when cited.
            {opportunities.length > 0 && (
              <>
                {' '}Consider creating more <strong>{opportunities[0].content_category}</strong> content - competitors are getting{' '}
                {opportunities[0].competitor_content_count} citations in this category.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Content Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Citation Volume by Content Type</CardTitle>
            <CardDescription>Which types of content get cited most by AI models</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={contentTypes}
                  dataKey="total_citations"
                  nameKey="content_category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.content_category}: ${entry.total_citations}`}
                >
                  {contentTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Visibility Impact</CardTitle>
            <CardDescription>Average visibility score when each content type is cited</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contentTypes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="content_category" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="avg_brand_visibility" fill="hsl(var(--primary))" name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Your Content vs Competitors */}
      <Card>
        <CardHeader>
          <CardTitle>Your Content vs Competitors</CardTitle>
          <CardDescription>See where you're winning and where there's opportunity</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={contentTypes} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="content_category" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="own_content_count" fill="hsl(var(--primary))" name="Your Content" />
              <Bar dataKey="competitor_content_count" fill="hsl(var(--destructive))" name="Competitor Content" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Content Type Performance Details</CardTitle>
          <CardDescription>Complete breakdown of citation metrics by content type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contentTypes.map((ct, idx) => (
              <div
                key={ct.content_category}
                className="border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{ct.content_category}</h3>
                  {Number(ct.own_content_count) > Number(ct.competitor_content_count) && (
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Leading
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Total Citations</div>
                    <div className="font-semibold">{ct.total_citations}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Visibility Impact</div>
                    <div className="font-semibold">{Number(ct.avg_brand_visibility).toFixed(1)}/10</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Your Content</div>
                    <div className="font-semibold">{ct.own_content_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Competitor</div>
                    <div className="font-semibold">{ct.competitor_content_count}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
