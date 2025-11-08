import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CitationQualityDashboard } from '@/features/citations/CitationQualityDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CitationComparisonView } from '@/features/citations/CitationComparisonView';
import { BarChart3, GitCompare, TrendingUp } from 'lucide-react';

export default function CitationAnalytics() {
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  const { data: prompts } = useQuery({
    queryKey: ['prompts-for-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Citation Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze citation quality, compare providers, and track trends
          </p>
        </div>

        <Tabs defaultValue="quality" className="space-y-6">
          <TabsList>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quality Metrics
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Provider Comparison
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quality" className="space-y-6">
            <CitationQualityDashboard />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select a Prompt</CardTitle>
                <CardDescription>
                  Compare how different providers cite sources for the same prompt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a prompt to compare citations" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts?.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.text.substring(0, 100)}
                        {prompt.text.length > 100 ? '...' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedPromptId && <CitationComparisonView promptId={selectedPromptId} />}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
