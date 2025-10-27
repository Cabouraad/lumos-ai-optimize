import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, RefreshCw, FileText, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useNavigate } from 'react-router-dom';

interface WeeklyReport {
  id: string;
  week_start_date: string;
  week_end_date: string;
  status: string; // Changed from literal union to string to match DB
  file_path?: string | null;
  file_size_bytes?: number | null;
  generated_at?: string | null;
  error_message?: string | null;
  metadata?: any; // Changed to any to match Supabase Json type
}

export const WeeklyReports = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTier } = useSubscriptionGate();
  const navigate = useNavigate();
  

  // Don't render if feature flag is disabled
  if (!isFeatureEnabled('FEATURE_WEEKLY_REPORT')) {
    return null;
  }

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('week_start_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };


  const downloadReport = async (report: WeeklyReport) => {
    if (currentTier === 'starter') {
      toast.error('Please upgrade to Growth or Pro to download reports');
      navigate('/pricing');
      return;
    }

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
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'generating': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'failed': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(1)}MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
        <div className="h-32 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Weekly Reports</h2>
          <p className="text-muted-foreground">
            Automatically generated weekly visibility performance reports
          </p>
        </div>
        <Button
          onClick={() => fetchReports()}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {currentTier === 'starter' ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Automated Weekly Reports</h3>
              <p className="text-muted-foreground mb-4 text-center">Get automated weekly CSV reports of your visibility performance</p>
              <Button onClick={() => navigate('/pricing')}>
                Upgrade to Growth or Pro
              </Button>
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No reports yet</h3>
              <p className="text-muted-foreground mb-4">Reports are generated automatically every Monday</p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Week of {formatDate(report.week_start_date)}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(report.week_start_date)} - {formatDate(report.week_end_date)}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(report.status)}
                  >
                    {report.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {report.metadata?.prompts_analyzed && (
                      <div>
                        <span className="text-muted-foreground">Prompts:</span>
                        <div className="font-medium">{report.metadata.prompts_analyzed}</div>
                      </div>
                    )}
                    {report.metadata?.total_responses && (
                      <div>
                        <span className="text-muted-foreground">Responses:</span>
                        <div className="font-medium">{report.metadata.total_responses}</div>
                      </div>
                    )}
                    {report.file_size_bytes && (
                      <div>
                        <span className="text-muted-foreground">Size:</span>
                        <div className="font-medium">{formatFileSize(report.file_size_bytes)}</div>
                      </div>
                    )}
                    {report.generated_at && (
                      <div>
                        <span className="text-muted-foreground">Generated:</span>
                        <div className="font-medium">{formatDate(report.generated_at)}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {report.status === 'completed' && report.file_path && currentTier !== 'starter' && (
                      <Button
                        onClick={() => downloadReport(report)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </Button>
                    )}
                    {report.status === 'completed' && currentTier === 'starter' && (
                      <Button
                        onClick={() => navigate('/pricing')}
                        size="sm"
                        variant="default"
                      >
                        Upgrade to Download
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
          ))
        )}
      </div>
    </div>
  );
};