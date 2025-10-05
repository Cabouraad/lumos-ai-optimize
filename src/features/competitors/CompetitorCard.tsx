import { TrendingUp, TrendingDown } from 'lucide-react';
import { CompetitorSummaryRow } from './api';

type Props = {
  competitor: CompetitorSummaryRow;
  rank: number;
};

/**
 * Card component for displaying individual competitor data
 * Shows mentions, prompts, avg score, share percentage, and trend
 */
export default function CompetitorCard({ competitor, rank }: Props) {
  const trendValue = competitor.trend_score ?? 0;
  const isPositiveTrend = trendValue > 0.5; // threshold for visual indicator
  const isNegativeTrend = trendValue < 0.3;

  return (
    <div className="rounded-lg border border-border p-4 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-6 text-center">
            <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{competitor.competitor_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {competitor.total_mentions} mentions across {competitor.distinct_prompts} prompts
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-lg font-bold text-foreground">
            {competitor.share_pct?.toFixed(1) ?? 0}%
          </div>
          {(isPositiveTrend || isNegativeTrend) && (
            <div className={`flex items-center gap-1 text-xs ${isPositiveTrend ? 'text-green-600' : 'text-red-500'}`}>
              {isPositiveTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="font-medium">{trendValue.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border-t border-border pt-3">
        <div>
          <div className="text-muted-foreground mb-1">Avg Score</div>
          <div className="font-semibold">{competitor.avg_score?.toFixed(1) ?? '—'}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Last Seen</div>
          <div className="font-semibold">
            {competitor.last_seen 
              ? new Date(competitor.last_seen).toLocaleDateString()
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
