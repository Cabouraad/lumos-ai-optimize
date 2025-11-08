import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TopCitedContent } from '@/features/citations/TopCitedContent';
import { ContentTypeAnalysis } from '@/features/citations/ContentTypeAnalysis';
import { CompetitiveCitationInsights } from '@/features/citations/CompetitiveCitationInsights';
import { CitationHealthDashboard } from '@/features/citations/CitationHealthDashboard';
import { PriorityRecommendations } from '@/features/citations/PriorityRecommendations';
import { Target, TrendingUp, FileText } from 'lucide-react';

export default function CitationAnalytics() {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-8 w-8" />
              Citation Intelligence
            </h1>
            <p className="text-muted-foreground mt-2">
              Understand which content AI models trust and cite most - optimize your content strategy for maximum visibility
            </p>
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Health Dashboard - Always Visible */}
        <CitationHealthDashboard days={Number(timeRange)} />

        {/* Priority Recommendations */}
        <PriorityRecommendations days={Number(timeRange)} />

        {/* Detailed Analysis Tabs */}
        <Tabs defaultValue="top-content" className="space-y-6">
          <TabsList>
            <TabsTrigger value="top-content" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Cited Content
            </TabsTrigger>
            <TabsTrigger value="content-types" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content Types
            </TabsTrigger>
            <TabsTrigger value="competitive" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Competitive Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top-content" className="space-y-6">
            <TopCitedContent days={Number(timeRange)} />
          </TabsContent>

          <TabsContent value="content-types" className="space-y-6">
            <ContentTypeAnalysis days={Number(timeRange)} />
          </TabsContent>

          <TabsContent value="competitive" className="space-y-6">
            <CompetitiveCitationInsights days={Number(timeRange)} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
