import { TrendingDown, TrendingUp, Minus, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface VisibilityAlertCardProps {
  previousScore: number;
  currentScore: number;
  keyword?: string;
  winningCompetitor?: string;
  previousRank?: number;
  currentRank?: number;
  className?: string;
  onAnalyzeClick?: () => void;
}

// Mini sparkline component for the trend visualization
const Sparkline = ({ data, isNegative }: { data: number[]; isNegative: boolean }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 100;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const pathD = `M ${points}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${isNegative ? 'neg' : 'pos'}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isNegative ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))'} />
          <stop offset="100%" stopColor={isNegative ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 36%)'} />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={`url(#sparkline-gradient-${isNegative ? 'neg' : 'pos'})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End point indicator */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="4"
        fill={isNegative ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 36%)'}
        className={isNegative ? 'animate-pulse' : ''}
      />
    </svg>
  );
};

export const VisibilityAlertCard = ({
  previousScore,
  currentScore,
  keyword,
  winningCompetitor,
  previousRank,
  currentRank,
  className,
  onAnalyzeClick,
}: VisibilityAlertCardProps) => {
  const scoreDiff = currentScore - previousScore;
  const percentChange = previousScore > 0 ? Math.round((scoreDiff / previousScore) * 100) : 0;
  
  const isDropped = scoreDiff < 0;
  const isStable = scoreDiff === 0;
  const isUp = scoreDiff > 0;

  // Generate sparkline data (simulated trend ending at current state)
  const generateSparklineData = () => {
    const baseData = [previousScore];
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const progress = i / steps;
      const noise = (Math.random() - 0.5) * 5;
      baseData.push(previousScore + (scoreDiff * progress) + noise);
    }
    baseData.push(currentScore);
    return baseData;
  };

  const sparklineData = generateSparklineData();

  // Dropped state - red alert
  if (isDropped) {
    return (
      <Card className={cn(
        "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 shadow-lg transition-all duration-300 hover:shadow-xl",
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-lg font-semibold text-red-700 dark:text-red-300">
                Visibility Drop Detected
              </CardTitle>
            </div>
            <Badge variant="destructive" className="font-bold text-sm">
              {percentChange}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {keyword && (
            <div className="bg-red-100 dark:bg-red-900/40 rounded-lg px-3 py-2 border-l-4 border-red-500">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Affected Keyword:</p>
              <p className="text-red-800 dark:text-red-200 font-semibold">"{keyword}"</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {previousRank && currentRank && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Last Week: <span className="text-green-600 font-medium">Rank #{previousRank}</span>
                  </span>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-muted-foreground">
                    Today: <span className="text-red-600 font-bold">Rank #{currentRank}</span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Score:</span>
                <span className="text-green-600 font-medium">{previousScore}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-red-600 font-bold">{currentScore}</span>
              </div>
            </div>
            <Sparkline data={sparklineData} isNegative={true} />
          </div>

          {winningCompetitor && (
            <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <p className="text-sm text-muted-foreground mb-1">Competitor Taking Your Position:</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-500" />
                {winningCompetitor}
              </p>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <Button 
              onClick={onAnalyzeClick}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-md"
              asChild={!onAnalyzeClick}
            >
              {onAnalyzeClick ? (
                <>
                  Analyze Root Cause
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              ) : (
                <Link to="/optimizations">
                  Analyze Root Cause
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              )}
            </Button>
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" asChild>
              <Link to="/competitors">
                View Competitors
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Stable state - neutral card
  if (isStable) {
    return (
      <Card className={cn(
        "bg-muted/30 border-border shadow transition-all duration-300 hover:shadow-md",
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-muted">
                <Minus className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Visibility Stable
              </CardTitle>
            </div>
            <Badge variant="secondary" className="font-medium">
              No Change
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Your visibility score remains at <span className="font-semibold text-foreground">{currentScore}</span>
            </div>
            <Sparkline data={sparklineData} isNegative={false} />
          </div>
          
          <p className="text-sm text-muted-foreground">
            Your AI search presence is holding steady. Keep monitoring for changes.
          </p>

          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard">
              <Sparkles className="mr-2 w-4 h-4" />
              View Full Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Up state - green success card
  return (
    <Card className={cn(
      "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 shadow-lg transition-all duration-300 hover:shadow-xl",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg font-semibold text-green-700 dark:text-green-300">
              Visibility Improved!
            </CardTitle>
          </div>
          <Badge className="bg-green-600 hover:bg-green-700 font-bold text-sm">
            +{percentChange}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {keyword && (
          <div className="bg-green-100 dark:bg-green-900/40 rounded-lg px-3 py-2 border-l-4 border-green-500">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Winning Keyword:</p>
            <p className="text-green-800 dark:text-green-200 font-semibold">"{keyword}"</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {previousRank && currentRank && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Last Week: <span className="text-muted-foreground font-medium">Rank #{previousRank}</span>
                </span>
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">
                  Today: <span className="text-green-600 font-bold">Rank #{currentRank}</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Score:</span>
              <span className="text-muted-foreground font-medium">{previousScore}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-green-600 font-bold">{currentScore}</span>
            </div>
          </div>
          <Sparkline data={sparklineData} isNegative={false} />
        </div>

        <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-300">
            🎉 Your optimization efforts are paying off! Keep building on this momentum.
          </p>
        </div>

        <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
          <Link to="/dashboard">
            <Sparkles className="mr-2 w-4 h-4" />
            View Performance Details
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default VisibilityAlertCard;
