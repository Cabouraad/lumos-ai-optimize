import { useLlumosScore, getScoreColor, useComputeLlumosScore } from '@/hooks/useLlumosScore';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, Target, Eye, Award, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useBrand } from '@/contexts/BrandContext';

const submetricDetails = {
  pr: {
    icon: Eye,
    name: 'Presence Rate',
    weight: 30,
    description: 'How often your brand appears in AI responses',
    calculation: '(Responses with brand / Total responses) × 100',
    why: 'Higher presence means your brand is being considered and mentioned by AI systems when relevant topics are discussed.',
    tips: [
      'Create comprehensive, authoritative content covering your key topics',
      'Ensure your content is indexed and accessible to AI systems',
      'Build consistent brand mentions across credible sources'
    ]
  },
  pp: {
    icon: Target,
    name: 'Prominence Position',
    weight: 24,
    description: 'Your average position when mentioned in responses',
    calculation: '100 - (Average position index × 10), capped at 100',
    why: 'Being mentioned first or early in responses indicates AI systems view your brand as a primary authority.',
    tips: [
      'Become the definitive source for your domain',
      'Focus on high-quality, comprehensive content',
      'Build strong domain authority and credibility'
    ]
  },
  cv: {
    icon: TrendingUp,
    name: 'Coverage Variance',
    weight: 18,
    description: 'Consistency of mentions across different prompts',
    calculation: '100 - (Standard deviation of presence rates × 100)',
    why: 'Consistent presence across topics shows comprehensive coverage and reduces vulnerability to prompt variations.',
    tips: [
      'Cover all aspects of your domain, not just core topics',
      'Address long-tail queries and niche questions',
      'Maintain topical authority across your entire field'
    ]
  },
  ca: {
    icon: Award,
    name: 'Citation Authority',
    weight: 20,
    description: 'Quality and authority of sources citing your brand',
    calculation: 'Weighted average of citation quality based on domain authority and brand mentions',
    why: 'Being cited by authoritative sources increases trust signals and improves AI system confidence in your brand.',
    tips: [
      'Build relationships with authoritative sites in your industry',
      'Create link-worthy, original research and resources',
      'Engage with industry publications and thought leaders',
      'Ensure your brand is mentioned in high-quality citations'
    ],
    disabled: false
  },
  cs: {
    icon: Zap,
    name: 'Competitive Share',
    weight: 18,
    description: 'Your share of responses vs. competitors',
    calculation: '(Responses with brand / (Responses with brand + Responses with competitors)) × 100',
    why: 'Higher competitive share means AI systems favor your brand over alternatives in your space.',
    tips: [
      'Differentiate your content and value proposition',
      'Establish thought leadership in your niche',
      'Create content that competitors can\'t easily replicate'
    ]
  },
  fc: {
    icon: RefreshCw,
    name: 'Freshness & Consistency',
    weight: 10,
    description: 'Recency and frequency of brand mentions',
    calculation: '(Frequency score × 0.4 + Recency score × 0.6)',
    why: 'Recent and frequent mentions signal active relevance and current authority in your field.',
    tips: [
      'Maintain a regular content publishing schedule',
      'Update existing content to stay current',
      'Engage in timely discussions and trending topics'
    ]
  }
};

const scoreTiers = [
  { name: 'Excellent', min: 760, max: 900, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { name: 'Very Good', min: 700, max: 759, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  { name: 'Good', min: 640, max: 699, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  { name: 'Fair', min: 580, max: 639, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { name: 'Needs Improvement', min: 300, max: 579, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' }
];

export default function LlumosScore() {
  const navigate = useNavigate();
  const { selectedBrand } = useBrand();
  const { data: scoreData, isLoading, error } = useLlumosScore(undefined, selectedBrand?.id);
  const { mutate: recomputeScore, isPending: isRecomputing } = useComputeLlumosScore();

  const handleRefresh = () => {
    recomputeScore(
      { 
        scope: 'org', 
        force: true 
      },
      {
        onSuccess: () => {
          toast.success('Score refreshed successfully');
        },
        onError: () => {
          toast.error('Failed to refresh score');
        }
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="space-y-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !scoreData) {
    return (
      <Layout>
        <div className="container mx-auto p-6 max-w-6xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Score Not Available</h2>
              <p className="text-muted-foreground mb-4">
                Unable to load your Llumos Score. Please try again later.
              </p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const scoreColor = getScoreColor(scoreData.score);
  const isInsufficientData = scoreData.score === 500 && scoreData.reason === 'insufficient_data';

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-bg">
        <div className="container mx-auto p-6 max-w-6xl space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRecomputing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRecomputing ? 'animate-spin' : ''}`} />
                Refresh Score
              </Button>
            </div>
            <h1 className="text-4xl font-display font-bold text-foreground mb-2">
              Llumos Score Analysis
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-muted-foreground text-lg">
                Comprehensive breakdown of your AI visibility performance
              </p>
              <Badge variant="secondary" className="text-xs">
                {scoreData.refreshedAt ? (
                  <>Refreshed {formatDistanceToNow(new Date(scoreData.refreshedAt), { addSuffix: true })}</>
                ) : scoreData.window?.end ? (
                  <>Updated {formatDistanceToNow(new Date(scoreData.window.end), { addSuffix: true })}</>
                ) : (
                  <>Loading...</>
                )}
              </Badge>
            </div>
          </div>

          {/* Insufficient Data Warning */}
          {isInsufficientData && (
            <Card className="border-warning bg-warning/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                   <h3 className="font-semibold text-warning mb-1">Insufficient Data</h3>
                    <p className="text-sm text-muted-foreground">
                      Your Llumos Score requires at least 3 successful responses within the last 28 days to calculate accurately. 
                      {scoreData.totalResponses !== undefined && (
                        <> Currently: {scoreData.totalResponses} response(s).</>
                      )}
                      {' '}Add more prompts and run them regularly to get your personalized score.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Score Display */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-elevated">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Score Dial */}
                <div className="flex flex-col items-center">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        className="text-muted opacity-20"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${(scoreData.composite / 100) * 440} 440`}
                        className={scoreColor}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className={`text-5xl font-bold ${scoreColor}`}>
                          {scoreData.score}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {scoreData.tier}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <div className="text-2xl font-semibold text-foreground">
                      {scoreData.composite.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Composite Score</div>
                  </div>
                </div>

                {/* Score Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Your AI Visibility Score
                    </h2>
                    <p className="text-muted-foreground">
                      The Llumos Score measures your brand's visibility and authority across AI systems on a scale of 300-900. 
                      It's calculated from six key metrics analyzing your brand's presence, position, and competitive strength.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">
                      Rolling 28-day window
                    </Badge>
                    {scoreData.totalResponses !== undefined && scoreData.totalResponses > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {scoreData.totalResponses} response{scoreData.totalResponses !== 1 ? 's' : ''} analyzed
                      </Badge>
                    )}
                    {scoreData.window?.start && scoreData.window?.end && (
                      <Badge variant="outline" className="text-xs">
                        {new Date(scoreData.window.start).toLocaleDateString()} - {new Date(scoreData.window.end).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Calculation Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Score Calculation Methodology
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 text-foreground">Overall Formula</h3>
                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                  Llumos Score = 300 + (Composite/100 × 600)
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  The score ranges from 300 (minimum) to 900 (maximum), with the composite percentage determining your position within this range.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-3 text-foreground">Composite Calculation (Weighted Average)</h3>
                <div className="space-y-2">
                  {Object.entries(submetricDetails).map(([key, details]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <details.icon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{details.name}</span>
                      </div>
                      <Badge variant="secondary">{details.weight}%</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Each submetric is scored 0-100, then weighted according to its importance to create the composite score.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Six Pillars */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Score Breakdown: The Six Pillars</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(submetricDetails).map(([key, details]) => {
                const submetricScore = scoreData.submetrics[key as keyof typeof scoreData.submetrics] || 0;
                const Icon = details.icon;
                const isDisabled = 'disabled' in details && details.disabled;

                return (
                  <Card key={key} className={`hover:shadow-soft transition-smooth ${isDisabled ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isDisabled ? 'bg-muted' : 'bg-primary/10'}`}>
                            <Icon className={`h-5 w-5 ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{details.name}</CardTitle>
                              {isDisabled && (
                                <Badge variant="secondary" className="text-xs">Not Available</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {details.weight > 0 ? `${details.weight}% weight` : 'Currently excluded'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`}>
                            {submetricScore}
                          </div>
                          <div className="text-xs text-muted-foreground">/ 100</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isDisabled && 'disabledReason' in details && (
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {(details as any).disabledReason}
                          </p>
                        </div>
                      )}
                      <Progress value={submetricScore} className={`h-2 ${isDisabled ? 'opacity-50' : ''}`} />
                      
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">What it measures:</h4>
                        <p className="text-sm text-muted-foreground">{details.description}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">Calculation:</h4>
                        <p className="text-xs font-mono bg-muted p-2 rounded">{details.calculation}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">Why it matters:</h4>
                        <p className="text-sm text-muted-foreground">{details.why}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">How to improve:</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {details.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Score Tiers Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Score Tier Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {scoreTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`p-4 rounded-lg ${tier.bg} border ${
                      scoreData.score >= tier.min && scoreData.score <= tier.max
                        ? 'border-current ring-2 ring-offset-2 ring-current'
                        : 'border-transparent'
                    }`}
                  >
                    <div className={`font-semibold mb-1 ${tier.color}`}>{tier.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {tier.min}–{tier.max}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Citation Authority Insights */}
          {scoreData?.submetrics?.ca > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Citation Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your Citation Authority score measures the quality and authority of sources that cite your brand in AI responses. 
                    Higher scores indicate stronger trust signals from authoritative domains.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{scoreData.submetrics.ca.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Citation Authority Score</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-foreground">20%</div>
                      <div className="text-xs text-muted-foreground mt-1">Weight in Overall Score</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-foreground">Active</div>
                      <div className="text-xs text-muted-foreground mt-1">Feature Status</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2 text-sm">How to Improve Citation Authority</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Focus on earning citations from high-authority domains (Tier 1 & 2 sources)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Ensure your brand is properly mentioned when cited in authoritative content</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Build relationships with industry publications and thought leaders</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Create original research and resources worthy of citation</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Back Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => navigate('/dashboard')}
              size="lg"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
