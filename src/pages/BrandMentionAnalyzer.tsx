import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrandMentionAnalytics, BrandMentionSource } from "@/hooks/useBrandMentionAnalytics";
import { Building2, Users, TrendingUp, ExternalLink } from "lucide-react";

export default function BrandMentionAnalyzer() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: analytics, isLoading } = useBrandMentionAnalytics(timeRange);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Brand Mention Analyzer</h1>
            <p className="text-muted-foreground mt-2">
              Analyze which citation sources mention your brand vs competitors
            </p>
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Sources</CardDescription>
                  <CardTitle className="text-3xl">{analytics?.totalSources || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Unique citation sources</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Your Brand
                  </CardDescription>
                  <CardTitle className="text-3xl">{analytics?.sourcesWithOrgBrand || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.orgBrandRate.toFixed(1)}% of sources
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Competitors
                  </CardDescription>
                  <CardTitle className="text-3xl">{analytics?.sourcesWithCompetitors || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.competitorRate.toFixed(1)}% of sources
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Both Mentioned
                  </CardDescription>
                  <CardTitle className="text-3xl">{analytics?.sourcesWithBoth || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Competitive comparison sources
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="org-brands" className="space-y-4">
              <TabsList>
                <TabsTrigger value="org-brands">Your Brand Sources</TabsTrigger>
                <TabsTrigger value="competitors">Competitor Sources</TabsTrigger>
                <TabsTrigger value="both">Comparison Sources</TabsTrigger>
              </TabsList>

              <TabsContent value="org-brands" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Sources Mentioning Your Brand</CardTitle>
                    <CardDescription>
                      Citation sources that frequently mention your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SourceList sources={analytics?.topOrgBrandSources || []} type="org" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="competitors" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Sources Mentioning Competitors</CardTitle>
                    <CardDescription>
                      Citation sources that frequently mention competitor brands
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SourceList sources={analytics?.topCompetitorSources || []} type="competitor" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="both" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Comparison Sources</CardTitle>
                    <CardDescription>
                      Sources that mention both your brand and competitors
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SourceList 
                      sources={(analytics?.sources || [])
                        .filter(s => s.mentionsOrgBrand && s.mentionsCompetitor)
                        .sort((a, b) => b.citationCount - a.citationCount)
                        .slice(0, 20)
                      } 
                      type="both" 
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}

function SourceList({ sources, type }: { sources: BrandMentionSource[]; type: 'org' | 'competitor' | 'both' }) {
  if (sources.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        No sources found for this category
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, idx) => (
        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{source.title || source.domain}</h4>
              <Badge variant="secondary" className="shrink-0">
                {source.citationCount} {source.citationCount === 1 ? 'citation' : 'citations'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{source.domain}</p>
            
            <div className="flex flex-wrap gap-2">
              {type !== 'competitor' && source.brandNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {source.brandNames.map((brand, i) => (
                    <Badge key={i} variant="default" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {brand}
                    </Badge>
                  ))}
                </div>
              )}
              {type !== 'org' && source.competitorNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {source.competitorNames.map((comp, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {comp}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-2 hover:bg-accent rounded-md transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      ))}
    </div>
  );
}
