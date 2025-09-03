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
import { Download, FileText, Crown, Calendar, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Report {
  id: string;
  week_key: string;  
  period_start: string;
  period_end: string;
  storage_path: string;
  byte_size: number | null;
  created_at: string;
}

export default function Reports() {
  const { orgData } = useAuth();
  const { hasAccessToApp, canAccessRecommendations, daysRemainingInTrial } = useSubscriptionGate();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const accessGate = hasAccessToApp();
  const reportsAccess = canAccessRecommendations(); // Using recommendations as proxy for Growth/Pro access

  useEffect(() => {
    if (orgData?.organizations?.id && reportsAccess.hasAccess) {
      loadReports();
    } else {
      setLoading(false);
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
        toast({
          title: "Error loading reports",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error loading reports", 
        description: "Failed to load reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          toast({
            title: "Access Denied",
            description: "Upgrade to Growth or Pro plan to download reports.",
            variant: "destructive",
          });
          return;
        }
        
        console.error('Error generating download URL:', error);
        toast({
          title: "Download failed",
          description: error.message || "Failed to generate download link",
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        // Open download in new tab
        window.open(data.url, '_blank');
        toast({
          title: "Download started",
          description: "Your report is being downloaded.",
        });
      } else {
        toast({
          title: "Download failed",
          description: "Failed to generate download link",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Download failed",
        description: "Failed to download report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
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
        <TrialBanner daysRemaining={daysRemainingInTrial || 0} />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-2">
              Weekly visibility reports for your brand
            </p>
          </div>
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
          // Reports table for Growth/Pro users
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>
                Download your weekly brand visibility reports
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
                // Empty state
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
                  <p className="text-muted-foreground">
                    Reports generate weekly after your scans. Check back Monday mornings.
                  </p>
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
                            {downloadingId === report.id ? 'Downloading...' : 'Download'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Information card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Weekly Reports</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Reports are automatically generated every Monday at 08:00 UTC for the previous week
            </p>
            <p>
              • Each report contains brand visibility metrics, competitor analysis, and recommendations
            </p>
            <p>
              • Download links expire after 5 minutes for security
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