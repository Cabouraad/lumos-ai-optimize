import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format, isWithinInterval } from 'date-fns';

interface DailyVisibility {
  date: string;
  avgScore: number;
  presenceRate: number;
}

interface WeeklyTrendData {
  dailyData: DailyVisibility[];
  currentWeekAvg: number;
  previousWeekAvg: number;
  percentageChange: number;
}

export function useWeeklyVisibilityTrend(orgId: string | undefined) {
  return useQuery({
    queryKey: ['weekly-visibility-trend', orgId],
    queryFn: async (): Promise<WeeklyTrendData> => {
      if (!orgId) throw new Error('Organization ID required');

      const today = startOfDay(new Date());
      const fourteenDaysAgo = subDays(today, 14);

      // Fetch last 14 days of visibility data
      const { data, error } = await supabase
        .from('prompt_provider_responses')
        .select('run_at, score, org_brand_present, org_id')
        .eq('org_id', orgId)
        .gte('run_at', fourteenDaysAgo.toISOString())
        .order('run_at', { ascending: true });

      if (error) throw error;

      // Group by day and calculate averages
      const dailyMap = new Map<string, { scores: number[], presenceCount: number, total: number }>();
      
      data?.forEach(row => {
        const date = format(new Date(row.run_at), 'yyyy-MM-dd');
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { scores: [], presenceCount: 0, total: 0 });
        }
        const dayData = dailyMap.get(date)!;
        dayData.scores.push(row.score);
        if (row.org_brand_present) dayData.presenceCount++;
        dayData.total++;
      });

      // Create daily data for last 7 days
      const dailyData: DailyVisibility[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayData = dailyMap.get(dateStr);
        
        dailyData.push({
          date: format(date, 'MMM dd'),
          avgScore: dayData 
            ? dayData.scores.reduce((a, b) => a + b, 0) / dayData.scores.length 
            : 0,
          presenceRate: dayData 
            ? (dayData.presenceCount / dayData.total) * 100 
            : 0,
        });
      }

      // Calculate current week (last 7 days) average
      const currentWeekData = Array.from(dailyMap.entries())
        .filter(([date]) => {
          const d = new Date(date);
          return isWithinInterval(d, { start: subDays(today, 6), end: today });
        });
      
      const currentWeekScores = currentWeekData.flatMap(([, data]) => data.scores);
      const currentWeekAvg = currentWeekScores.length > 0
        ? currentWeekScores.reduce((a, b) => a + b, 0) / currentWeekScores.length
        : 0;

      // Calculate previous week (8-14 days ago) average
      const previousWeekData = Array.from(dailyMap.entries())
        .filter(([date]) => {
          const d = new Date(date);
          return isWithinInterval(d, { start: subDays(today, 13), end: subDays(today, 7) });
        });
      
      const previousWeekScores = previousWeekData.flatMap(([, data]) => data.scores);
      const previousWeekAvg = previousWeekScores.length > 0
        ? previousWeekScores.reduce((a, b) => a + b, 0) / previousWeekScores.length
        : 0;

      // Calculate percentage change
      const percentageChange = previousWeekAvg > 0
        ? ((currentWeekAvg - previousWeekAvg) / previousWeekAvg) * 100
        : 0;

      return {
        dailyData,
        currentWeekAvg,
        previousWeekAvg,
        percentageChange,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
