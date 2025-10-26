import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { AdminDiagnosticPanel } from '@/components/AdminDiagnosticPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshButton } from '@/components/RefreshButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Lightbulb, FileText, Download } from 'lucide-react';
import { useRealTimeDashboard } from '@/hooks/useRealTimeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';
import { useContentOptimizations } from '@/features/visibility-optimizer/hooks';
import { LlumosScoreWidget } from '@/components/llumos/LlumosScoreWidget';

export default function Dashboard() {
  const { user, orgData, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const { hasAccessToApp, limits } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const { data: optimizations = [] } = useContentOptimizations();
  const [latestReport, setLatestReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [chartView, setChartView] = useState<'score' | 'competitors'>('score');
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Post-checkout: refresh subscription and clean URL
  useEffect(() => {
    const sub = searchParams.get('subscription');
    const portalReturn = searchParams.get('portal_return');
    if (sub === 'success' || portalReturn === 'true') {
      // Refresh subscription on return from Stripe
      try {
        checkSubscription?.();
      } catch (e) {
        console.error('checkSubscription error:', e);
      }
      toast({
        title: 'Subscription updated',
        description: 'Your access has been refreshed.',
      });
      // Clean the URL
      navigate('/dashboard', { replace: true });
    }
  }, [checkSubscription, navigate, searchParams, toast]);
  
  // Use real-time dashboard hook with optimized interval
  const { data: dashboardData, loading, error, refresh, lastUpdated } = useRealTimeDashboard({
    autoRefreshInterval: 180000, // 3 minutes (optimized for performance)
    enableAutoRefresh: true
  });
  
  // CRITICAL: Force redirect to onboarding if no org in multiple scenarios
  useEffect(() => {
    // 1. Check orgData structure first
    const hasOrg = Boolean(orgData?.organizations?.id || orgData?.org_id);
    if (user && !hasOrg) {
      console.log('[Dashboard] No org in orgData, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
      return;
    }
    
    // 2. Check if dashboard data indicates no org
    if (dashboardData && !dashboardData.success && dashboardData.noOrg) {
      console.log('[Dashboard] Dashboard data indicates no org, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
      return;
    }
  }, [user, orgData, dashboardData, navigate]);

  // Auto-trigger weekly report generation once
  useEffect(() => {
    const hasTriggeredReports = localStorage.getItem('weekly-reports-triggered');
    if (!hasTriggeredReports && user && orgData?.organizations?.id) {
      const triggerReports = async () => {
        try {
          console.log('[Dashboard] Auto-triggering weekly report generation...');
          const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
            body: {}
          });
          
          if (error) {
            console.error('[Dashboard] Error auto-triggering reports:', error);
          } else {
            console.log('[Dashboard] Weekly reports triggered successfully:', data);
          }
          
          // Mark as triggered so we don't run again
          localStorage.setItem('weekly-reports-triggered', 'true');
        } catch (error) {
          console.error('[Dashboard] Failed to trigger reports:', error);
        }
      };
      
      // Trigger after a short delay to ensure everything is loaded
      const timeoutId = setTimeout(triggerReports, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [user, orgData, toast]);

  // Memoize chart data to prevent unnecessary re-renders
  const memoizedChartData = useMemo(() => {
    const chartData = dashboardData?.chartData || [];
    console.log('[Dashboard] Chart data memoized:', {
      length: chartData.length,
      sampleData: chartData.slice(0, 3),
      scores: chartData.map(d => d.score),
      hasValidScores: chartData.some(d => d.score != null && !isNaN(d.score))
    });
    return chartData;
  }, [dashboardData?.chartData]);

  // Compute brand presence stats from existing data
  const presenceStats = useMemo(() => {
    if (!dashboardData?.responses || dashboardData.responses.length === 0) {
      return { rate: 0, sparklineData: [], totalCount: 0, presenceCount: 0 };
    }

    // Get last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Filter successful responses in last 7 days
    const recentResponses = dashboardData.responses.filter((response: any) => {
      const responseDate = new Date(response.run_at || response.created_at);
      return responseDate >= sevenDaysAgo && response.status === 'success';
    });

    const totalCount = recentResponses.length;
    const presenceCount = recentResponses.filter((response: any) => response.org_brand_present === true).length;
    const rate = totalCount > 0 ? (presenceCount / totalCount) * 100 : 0;

    // Create 7-day sparkline data
    const sparklineData: Array<{ value: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() - i);
      dayDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayResponses = recentResponses.filter((response: any) => {
        const responseDate = new Date(response.run_at || response.created_at);
        return responseDate >= dayDate && responseDate < nextDay;
      });
      
      const dayTotal = dayResponses.length;
      const dayPresence = dayResponses.filter((response: any) => response.org_brand_present === true).length;
      const dayRate = dayTotal > 0 ? (dayPresence / dayTotal) * 100 : 0;
      
      sparklineData.push({ value: dayRate });
    }

    return { rate, sparklineData, totalCount, presenceCount };
  }, [dashboardData?.responses]);

  // Compute competitor presence chart data
  const competitorChartData = useMemo(() => {
    if (chartView !== 'competitors' || !dashboardData?.responses || competitors.length === 0) {
      return [];
    }

    const chartData: any[] = [];
    
    // Create 7 days of data
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() - i);
      dayDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Filter responses for this day
      const dayResponses = dashboardData.responses.filter((response: any) => {
        const responseDate = new Date(response.run_at || response.created_at);
        return responseDate >= dayDate && responseDate < nextDay && response.status === 'success';
      });
      
      const dayData: any = {
        date: dayDate.toISOString(),
        orgPresence: 0
      };

      // Calculate org presence rate
      const totalDayResponses = dayResponses.length;
      if (totalDayResponses > 0) {
        const orgPresent = dayResponses.filter((r: any) => r.org_brand_present === true).length;
        dayData.orgPresence = Math.round((orgPresent / totalDayResponses) * 100);
      }

      // Calculate competitor presence rates
      competitors.forEach((competitor, index) => {
        const competitorResponses = dayResponses.filter((response: any) => {
          if (!response.competitors_json) return false;
          const competitors = Array.isArray(response.competitors_json) ? response.competitors_json : [response.competitors_json];
          return competitors.some((brand: string) => 
            brand && brand.toLowerCase().trim() === competitor.name.toLowerCase().trim()
          );
        });
        
        const competitorRate = totalDayResponses > 0 ? Math.round((competitorResponses.length / totalDayResponses) * 100) : 0;
        dayData[`competitor${index}`] = competitorRate;
      });

      chartData.push(dayData);
    }

    return chartData;
  }, [chartView, dashboardData?.responses, competitors]);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      if (isFeatureEnabled('FEATURE_WEEKLY_REPORT')) {
        loadLatestReport();
      }
      if (chartView === 'competitors') {
        loadCompetitors();
      }
    }
  }, [orgData?.organizations?.id, chartView]);

  // Transform optimizations for Quick Wins display
  const quickWins = useMemo(() => {
    return optimizations
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
      .slice(0, 3)
      .map(opt => ({
        id: opt.id,
        title: opt.title,
        rationale: opt.description,
        metadata: {
          impact: opt.priority_score > 70 ? 'high' : opt.priority_score > 40 ? 'medium' : 'low'
        }
      }));
  }, [optimizations]);

  const loadLatestReport = async () => {
    try {
      setLoadingReport(true);
      const orgId = orgData?.organizations?.id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('org_id', orgId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      setLatestReport(data);
    } catch (error) {
      console.error('Error loading latest report:', error);
      // Don't show toast error for report loading as it's secondary content
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadLatestReport = async () => {
    if (!latestReport) return;
    
    try {
      setLoadingReport(true);
      
      const response = await supabase.functions.invoke('weekly-report', {
        method: 'GET',
        body: { week: latestReport.week_key }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate download URL');
      }

      const { download_url } = response.data;
      if (!download_url) {
        throw new Error('No download URL received');
      }

      // Immediately trigger download since signed URL has short TTL (5 minutes)
      const link = document.createElement('a');
      link.href = download_url;
      link.download = `weekly-report-${latestReport.week_key}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download Started',
        description: `Weekly report for ${latestReport.week_key} is downloading.`,
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoadingReport(false);
    }
  };

  const loadCompetitors = async () => {
    try {
      setLoadingCompetitors(true);
      const orgId = orgData?.organizations?.id;
      if (!orgId) return;

      console.log('[Dashboard] Loading competitors for org:', orgId);

      const { data, error } = await supabase.rpc('get_org_competitor_summary', {
        p_org_id: orgId,
        p_days: 30
      });

      if (error) {
        console.error('[Dashboard] RPC error, triggering sync and falling back:', error);
        
        // Trigger competitor sync to populate brand_catalog
        try {
          const syncResult = await supabase.functions.invoke('trigger-competitor-sync');
          console.log('[Dashboard] Competitor sync triggered:', syncResult);
        } catch (syncError) {
          console.warn('[Dashboard] Could not trigger competitor sync:', syncError);
        }
        
        // Improved fallback: aggregate competitors from existing dashboard data
        const competitorMap = new Map();
        if (dashboardData?.responses) {
          dashboardData.responses.forEach((response: any) => {
            if (response.competitors_json && response.status === 'success') {
              const competitors = Array.isArray(response.competitors_json) ? response.competitors_json : [response.competitors_json];
              competitors.forEach((competitor: string) => {
                // More lenient filtering - include most legitimate competitors
                const trimmed = competitor.trim();
                if (trimmed && 
                    trimmed.length >= 2 && // Reduced from 3 to 2
                    !/^(price|these|offers|trade|cost|free|paid|premium|basic|pro|standard|email|web|app|system|data)$/i.test(trimmed) &&
                    !trimmed.match(/^[\d\s]*$/) && // Only exclude purely numeric/space strings
                    !trimmed.includes('<') && !trimmed.includes('>')) { // Exclude obvious HTML
                  const existing = competitorMap.get(trimmed);
                  competitorMap.set(trimmed, (existing || 0) + 1);
                }
              });
            }
          });
        }
        
        // Include competitors with 1+ mentions to provide better fallback data
        const fallbackCompetitors = Array.from(competitorMap.entries())
          .filter(([name, count]) => count >= 1) // Include all mentions for better coverage
          .map(([name, count]) => ({ name, total_mentions: count }))
          .sort((a, b) => b.total_mentions - a.total_mentions)
          .slice(0, 8); // Increased from 5 to 8 for more data
        
        console.log('[Dashboard] Fallback competitors loaded:', fallbackCompetitors.length, 'competitors found');
        setCompetitors(fallbackCompetitors);
        return;
      }
      
      // If RPC succeeded, use catalog data
      if (data && data.length > 0) {
        const mappedCompetitors = data
          .slice(0, 8)
          .map((competitor: any) => ({
            ...competitor,
            name: competitor.competitor_name || competitor.name
          }));
        
        console.log('[Dashboard] Catalog competitors loaded:', mappedCompetitors.length, 'competitors');
        setCompetitors(mappedCompetitors);
        return;
      }
      
      // If no catalog data, fall through to client-side aggregation
      console.log('[Dashboard] No catalog data found, using fallback');
    } catch (error) {
      console.error('Error loading competitors:', error);
    } finally {
      setLoadingCompetitors(false);
    }
  };

  const formatWeekPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric'
    };
    
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">AI visibility insights for your organization</p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="Dashboard"
              reason={appAccess.reason || ''}
              isTrialExpired={appAccess.isTrialExpired}
              daysRemainingInTrial={appAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Debug logging for troubleshooting
  console.log('[Dashboard] Render state:', {
    loading,
    hasData: !!dashboardData,
    metricsKeys: dashboardData?.metrics ? Object.keys(dashboardData.metrics) : 'no metrics',
    promptsCount: dashboardData?.prompts?.length || 0,
    chartDataPoints: dashboardData?.chartData?.length || 0,
    error: error?.message
  });

  if (loading) {
    console.log('[Dashboard] Showing loading skeleton');
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto p-6">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg"></div>
                ))}
              </div>
              <div className="h-64 bg-muted rounded-lg"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    console.log('[Dashboard] Showing error state:', error.message);
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto p-6">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Dashboard Error</h2>
              <p className="text-muted-foreground">Failed to load dashboard data. Please try refreshing.</p>
              <Button onClick={refresh}>Retry</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
                <DataFreshnessIndicator lastUpdated={lastUpdated} />
              </div>
              <p className="text-muted-foreground">AI visibility insights for your organization</p>
            </div>
            <RefreshButton 
              onRefresh={refresh}
              loading={loading}
              lastUpdated={lastUpdated}
              autoRefreshEnabled={true}
              showLastUpdated={true}
            />
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Llumos Score Widget */}
            <LlumosScoreWidget />
            
            {/* Other Metrics */}
            <DashboardMetrics 
              metrics={dashboardData?.metrics || {}}
              presenceStats={presenceStats}
              promptLimit={limits.promptsPerDay}
            />
          </div>

          {/* Visibility Trend Chart */}
          <DashboardChart 
            chartData={memoizedChartData}
            competitorChartData={competitorChartData}
            competitors={competitors}
            chartView={chartView}
            onChartViewChange={setChartView}
            loadingCompetitors={loadingCompetitors}
          />

          {/* Quick Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommendations Card */}
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <CardTitle>Quick Wins</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/optimizations')}
                  className="hover-lift"
                >
                  View All
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickWins.length > 0 ? (
                  quickWins.map((rec) => (
                    <div key={rec.id} className="border-l-4 border-l-primary pl-4 py-2 rounded-r bg-primary/5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{rec.title}</h4>
                        {rec.metadata?.impact && (
                          <Badge variant={rec.metadata.impact === 'high' ? 'default' : 'secondary'}>
                            {rec.metadata.impact}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.rationale}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recommendations yet</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/optimizations')}
                      className="mt-2"
                    >
                      Generate Recommendations
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly Reports Card */}
            {isFeatureEnabled('FEATURE_WEEKLY_REPORT') && (
              <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle>Weekly Reports</CardTitle>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/reports')}
                    className="hover-lift"
                  >
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingReport ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  ) : latestReport ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Week of {formatWeekPeriod(latestReport.period_start, latestReport.period_end)}</p>
                          <p className="text-xs text-muted-foreground">
                            Generated {new Date(latestReport.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadLatestReport}
                          disabled={loadingReport}
                          className="hover-lift"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      {latestReport.byte_size && (
                        <p className="text-xs text-muted-foreground">
                          Size: {(latestReport.byte_size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">No reports available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Admin Panel for Test Users */}
          {user?.email?.includes('@test.app') && (
            <AdminDiagnosticPanel />
          )}
        </div>
      </div>
    </Layout>
  );
}