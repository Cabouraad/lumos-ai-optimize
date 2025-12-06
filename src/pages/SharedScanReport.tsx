import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Award, Users, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';

interface ScanResult {
  id: string;
  score: number;
  rank: number | null;
  competitor_name: string | null;
  created_at: string;
  keyword: string;
  org_name: string | null;
}

export default function SharedScanReport() {
  const { token } = useParams<{ token: string }>();
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedScan() {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('scan_history')
          .select(`
            id,
            score,
            rank,
            competitor_name,
            created_at,
            keyword_id,
            tracked_keywords!inner(keyword),
            organizations:org_id(name)
          `)
          .eq('public_share_token', token)
          .single();

        if (fetchError || !data) {
          setError('This scan report is not available or the link has expired.');
          setLoading(false);
          return;
        }

        setScanData({
          id: data.id,
          score: data.score,
          rank: data.rank,
          competitor_name: data.competitor_name,
          created_at: data.created_at,
          keyword: (data.tracked_keywords as any)?.keyword || 'Unknown',
          org_name: (data.organizations as any)?.name || null,
        });
      } catch (err) {
        setError('Failed to load scan report');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedScan();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !scanData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <SEOHead 
          title="Scan Report Not Found - Llumos"
          description="This scan report is not available or the link has expired."
        />
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-xl font-semibold mb-2">Report Not Found</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
        <PoweredByFooter />
      </div>
    );
  }

  const scoreColor = scanData.score >= 7 ? 'text-green-500' : scanData.score >= 4 ? 'text-amber-500' : 'text-red-500';
  const scoreLabel = scanData.score >= 7 ? 'Excellent' : scanData.score >= 4 ? 'Good' : 'Needs Improvement';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <SEOHead 
        title={`AI Visibility Report: ${scanData.keyword} - Llumos`}
        description={`View the AI visibility scan results for "${scanData.keyword}". Score: ${scanData.score}/10.`}
      />
      
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Llumos
            </span>
          </Link>
          <Badge variant="secondary" className="text-xs">
            Shared Report
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Report Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Visibility Report</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Calendar className="h-4 w-4" />
            {new Date(scanData.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Keyword Card */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-muted-foreground">Keyword Analyzed:</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{scanData.keyword}</p>
          </CardContent>
        </Card>

        {/* Score Card */}
        <Card className="mb-6 border-2" style={{ borderColor: scanData.score >= 7 ? 'hsl(var(--chart-2))' : scanData.score >= 4 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))' }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Visibility Score</p>
                <div className="flex items-center gap-3">
                  <span className={`text-5xl font-bold ${scoreColor}`}>
                    {scanData.score.toFixed(1)}
                  </span>
                  <span className="text-2xl text-muted-foreground">/10</span>
                </div>
                <Badge variant="outline" className="mt-2">
                  {scoreLabel}
                </Badge>
              </div>
              <div className="text-right">
                {scanData.score >= 5 ? (
                  <TrendingUp className="h-16 w-16 text-green-500/30" />
                ) : (
                  <TrendingDown className="h-16 w-16 text-red-500/30" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rank Card */}
        {scanData.rank && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Ranking Position</p>
                  <p className="text-2xl font-bold">#{scanData.rank}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Competitor Card */}
        {scanData.competitor_name && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Users className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Competitor</p>
                  <p className="text-xl font-semibold">{scanData.competitor_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Card */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Want to track your AI visibility?</h3>
            <p className="text-muted-foreground mb-4">
              Get continuous monitoring and actionable insights with Llumos.
            </p>
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Start Free Trial
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>

      <PoweredByFooter />
    </div>
  );
}

function PoweredByFooter() {
  return (
    <footer className="py-8 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 hover:bg-muted transition-colors text-sm"
        >
          <span className="text-muted-foreground">Powered by</span>
          <span className="font-semibold text-primary">Llumos</span>
          <span className="text-muted-foreground">–</span>
          <span className="text-muted-foreground hover:text-foreground transition-colors">
            Run your own audit
          </span>
        </Link>
      </div>
    </footer>
  );
}
