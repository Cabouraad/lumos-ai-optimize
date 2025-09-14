import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TrialBanner } from '@/components/TrialBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Crown, Calendar, Users, RefreshCw, Clock, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Report {
  id: string;
  week_key: string;  
  period_start: string;
  period_end: string;
  storage_path: string;
  byte_size: number | null;
  created_at: string;
}

interface WeeklyReport {
  id: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
  file_path?: string | null;
  file_size_bytes?: number | null;
  generated_at?: string | null;
  error_message?: string | null;
  metadata?: any;
}

export default function Reports() {
  const { orgData } = useAuth();
  const { hasAccessToApp, canAccessRecommendations, daysRemainingInTrial, isOnTrial } = useSubscriptionGate();
  const { toast: showToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [csvReports, setCsvReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  const [activeTab, setActiveTab] = useState('pdf-reports');

  const accessGate = hasAccessToApp();
  const reportsAccess = canAccessRecommendations(); // Using recommendations as proxy for Growth/Pro access

  useEffect(() => {
    if (orgData?.organizations?.id && reportsAccess.hasAccess) {
      loadReports();
      loadCsvReports();
    } else {
      setLoading(false);
      setCsvLoading(false);
    }
  }, [orgData?.organizations?.id, reportsAccess.hasAccess]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('id, week_key, period_start, period_end, storage_path, byte_size, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading reports:', error);
        showToast({
          title: "Error loading reports",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      showToast({
        title: "Error loading reports", 
        description: "Failed to load reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCsvReports = async () => {
    try {
      setCsvLoading(true);
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('week_start_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading CSV reports:', error);
        showToast({
          title: "Error loading CSV reports",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setCsvReports(data || []);
    } catch (error) {
      console.error('Error loading CSV reports:', error);
      showToast({
        title: "Error loading CSV reports",
        description: "Failed to load CSV reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCsvLoading(false);
    }
  };

  const downloadReport = async (reportId: string) => {
    try {
      setDownloadingId(reportId);
      
      const { data, error } = await supabase.functions.invoke('reports-sign', {
        body: { reportId }
      });

      if (error) {
        if (error.message?.includes('plan_denied')) {
          showToast({
            title: "Access Denied",
            description: "Upgrade to Growth or Pro plan to download reports.",
            variant: "destructive",
          });
          return;
        }
        
        console.error('Error generating download URL:', error);
        showToast({
          title: "Download failed",
          description: error.message || "Failed to generate download link",
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        // Open download in new tab
        window.open(data.url, '_blank');
        showToast({
          title: "Download started",
          description: "Your report is being downloaded.",
        });
      } else {
        showToast({
          title: "Download failed",
          description: "Failed to generate download link",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      showToast({
        title: "Download failed",
        description: "Failed to download report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };


  const downloadCsvReport = async (report: WeeklyReport) => {
    if (!report.file_path) {
      toast.error('Report file not available');
      return;
    }

    try {
      const { data } = await supabase.storage
        .from('weekly-reports')
        .createSignedUrl(report.file_path, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        throw new Error('Failed to get download URL');
      }
    } catch (error) {
      console.error('Error downloading CSV report:', error);
      toast.error('Failed to download CSV report');
    }
  };


  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  };

  const formatPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`;
  };

  const formatGeneratedAt = (createdAt: string): string => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'generating': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'failed': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
    }
  };

  const formatCsvFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(1)}MB`;
  };

  const formatCsvDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const generatePdfReport = async () => {
    try {
      setGenerating(true);
      
      // Check if user is authenticated first
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        showToast({
          title: "Authentication required",
          description: "Please sign in to generate reports.",
          variant: "destructive",
        });
        return;
      }
      
      // Call the edge function with proper authentication
      // supabase.functions.invoke automatically handles authentication
      const { data, error } = await supabase.functions.invoke('weekly-report', {
        body: {} // Empty body for POST request
      });

      if (error) {
        console.error('Error generating PDF report:', error);
        showToast({
          title: "Generation failed",
          description: error.message || "Failed to send a request to the Edge Function",
          variant: "destructive",
        });
        return;
      }

      showToast({
        title: "Report generation started",
        description: "Your PDF report is being generated. Refresh in a few moments to see it.",
      });
      
      // Refresh reports after a short delay
      setTimeout(() => {
        loadReports();
      }, 2000);
      
    } catch (error) {
      console.error('Error generating PDF report:', error);
      showToast({
        title: "Generation failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateCsvReport = async () => {
    try {
      setGenerating(true);
      
      // CSV reports are generated via the scheduler, but we can trigger it manually
      // Note: This requires the weekly-report-scheduler to be accessible to users
      showToast({
        title: "CSV Generation",
        description: "CSV reports are currently generated automatically. Please check back on Monday after 8:10 AM UTC.",
      });
      
    } catch (error) {
      console.error('Error generating CSV report:', error);
      showToast({
        title: "Generation failed", 
        description: "Failed to generate CSV report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!accessGate.hasAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Access Required</h2>
            <p className="text-muted-foreground mb-6">{accessGate.reason}</p>
            <Button onClick={() => window.location.href = '/pricing'}>
              View Pricing Plans
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {isOnTrial && <TrialBanner daysRemaining={daysRemainingInTrial || 0} />}
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-2">
              Weekly visibility reports for your brand
            </p>
          </div>
          {reportsAccess.hasAccess && (
            <Button
              onClick={() => {
                loadReports();
                loadCsvReports();
              }}
              variant="outline"
              size="sm"
              disabled={loading || csvLoading || generating}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All
            </Button>
          )}
        </div>

        {!reportsAccess.hasAccess ? (
          // Upsell panel for Starter tier
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Upgrade to Access Reports</CardTitle>
              <CardDescription className="text-base">
                Get comprehensive weekly visibility insights with Growth or Pro plans
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Weekly PDF visibility summaries</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Top prompts & competitor share</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Recommendations snapshot</span>
                </div>
              </div>
              <Button size="lg" onClick={() => window.location.href = '/pricing'}>
                Upgrade to Growth
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Tabbed interface for Growth/Pro users
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdf-reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDF Reports
              </TabsTrigger>
              <TabsTrigger value="csv-reports" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                CSV Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf-reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>PDF Reports</CardTitle>
                  <CardDescription>
                    Comprehensive weekly brand visibility reports (automatically generated every Monday)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    // Loading skeleton
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : reports.length === 0 ? (
                    // Empty state with manual generation option
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No PDF reports yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Reports are generated automatically every Monday at 8:00 AM UTC.
                      </p>
                      <Button
                        onClick={generatePdfReport}
                        disabled={loading || generating}
                        variant="outline"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Generate Report Now
                      </Button>
                    </div>
                  ) : (
                    // Reports table
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Week</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Generated</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <Badge variant="outline">{report.week_key}</Badge>
                            </TableCell>
                            <TableCell>
                              {formatPeriod(report.period_start, report.period_end)}
                            </TableCell>
                            <TableCell>
                              {formatFileSize(report.byte_size)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatGeneratedAt(report.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadReport(report.id)}
                                disabled={downloadingId === report.id}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {downloadingId === report.id ? 'Downloading...' : 'Download PDF'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="csv-reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>CSV Reports</CardTitle>
                  <CardDescription>
                    Prompt-level data exports for detailed analysis (automatically generated weekly)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {csvLoading ? (
                    // Loading skeleton
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : csvReports.length === 0 ? (
                    // Empty state with manual generation option
                    <div className="text-center py-12">
                      <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No CSV reports yet</h3>
                      <p className="text-muted-foreground mb-4">
                        CSV reports are generated automatically every Monday at 8:10 AM UTC.
                      </p>
                      <Button
                        onClick={generateCsvReport}
                        disabled={csvLoading || generating}
                        variant="outline"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Generate CSV Now
                      </Button>
                    </div>
                  ) : (
                    // CSV reports list
                    <div className="space-y-4">
                      {csvReports.map((report) => (
                        <Card key={report.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    Week of {formatCsvDate(report.week_start_date)}
                                  </span>
                                  <Badge 
                                    variant="outline" 
                                    className={getStatusColor(report.status)}
                                  >
                                    {report.status}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatCsvDate(report.week_start_date)} - {formatCsvDate(report.week_end_date)}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm">
                                  {report.metadata?.prompts_analyzed && (
                                    <span>Prompts: <strong>{report.metadata.prompts_analyzed}</strong></span>
                                  )}
                                  {report.metadata?.total_responses && (
                                    <span>Responses: <strong>{report.metadata.total_responses}</strong></span>
                                  )}
                                  {report.file_size_bytes && (
                                    <span>Size: <strong>{formatCsvFileSize(report.file_size_bytes)}</strong></span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {report.status === 'completed' && report.file_path && (
                                  <Button
                                    onClick={() => downloadCsvReport(report)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download CSV
                                  </Button>
                                )}
                                {report.status === 'failed' && report.error_message && (
                                  <div className="text-sm text-red-600 max-w-md">
                                    Error: {report.error_message}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Information card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Weekly Reports</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • <strong>PDF Reports:</strong> Comprehensive weekly summaries generated automatically every Monday
            </p>
            <p>
              • <strong>CSV Reports:</strong> Raw prompt-level data exports generated automatically every Monday
            </p>
            <p>
              • Each report contains brand visibility metrics, competitor analysis, and performance insights
            </p>
            <p>
              • Download links expire after 1-5 minutes for security
            </p>
            <p>
              • Available to Growth and Pro subscribers
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}