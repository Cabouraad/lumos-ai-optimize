import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { TrialBanner } from '@/components/TrialBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Download, File, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Report {
  id: string;
  week_key: string;
  period_start: string;
  period_end: string;
  byte_size: number | null;
  created_at: string;
  storage_path: string;
  sha256: string | null;
}

export default function Reports() {
  const { user, orgData } = useAuth();
  const { hasAccessToApp } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadReports();
    }
  }, [orgData?.organizations?.id]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const orgId = orgData?.organizations?.id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('org_id', orgId)
        .order('period_start', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Error Loading Reports',
        description: 'Failed to load weekly reports. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (report: Report) => {
    try {
      setDownloadingId(report.id);
      
      // Call the weekly-report GET endpoint to get signed URL (5 minute TTL)
      const response = await supabase.functions.invoke('weekly-report', {
        method: 'GET',
        body: { week: report.week_key }
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
      link.download = `weekly-report-${report.week_key}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download Started',
        description: `Weekly report for ${report.week_key} is downloading.`,
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: startDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    };
    
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const formatGeneratedAt = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          {appAccess.daysRemainingInTrial && appAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={appAccess.daysRemainingInTrial} />
          )}
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Weekly Reports</h1>
            <p className="text-muted-foreground">Comprehensive visibility insights delivered weekly</p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Weekly reports are available with a paid subscription. {appAccess.reason}
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const showTrialBanner = appAccess.daysRemainingInTrial && appAccess.daysRemainingInTrial > 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-6 space-y-8">
          {showTrialBanner && (
            <TrialBanner daysRemaining={appAccess.daysRemainingInTrial!} />
          )}
          
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Weekly Reports</h1>
            <p className="text-muted-foreground">Comprehensive visibility insights delivered weekly</p>
          </div>

          {/* Reports List */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <File className="h-5 w-5 text-primary" />
                </div>
                <span>Generated Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading reports...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">No Reports Available</p>
                  <p className="text-muted-foreground mb-4">
                    Reports are generated weekly automatically on Monday mornings for the previous week.
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Reports include visibility scores, prompt performance, and competitor analysis</p>
                    <p>• First report will be available after your first complete week of usage</p>
                    <p>• Check back on Monday for your latest weekly insights</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300 hover-lift group">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                          <File className="h-5 w-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {report.week_key}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {formatPeriod(report.period_start, report.period_end)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Generated: {formatGeneratedAt(report.created_at)}</span>
                            <span>Size: {formatFileSize(report.byte_size)}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => downloadReport(report)}
                        disabled={downloadingId === report.id}
                        className="hover-lift"
                        size="sm"
                      >
                        {downloadingId === report.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-accent" />
                </div>
                <span>About Weekly Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Content Included</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Key visibility metrics and trends</li>
                    <li>• Top and poor performing prompts</li>
                    <li>• Competitor analysis and market share</li>
                    <li>• Recommendations summary</li>
                    <li>• Volume and usage statistics</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Generation Schedule</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Reports generated every Monday at 8:00 AM UTC</li>
                    <li>• Covers the previous week (Monday-Sunday)</li>
                    <li>• Automatically saved and available for download</li>
                    <li>• Historical reports remain accessible</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}