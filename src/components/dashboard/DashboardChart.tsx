import { memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface DashboardChartProps {
  competitorChartData: any[];
  competitors: any[];
  loadingCompetitors: boolean;
}

const DashboardChartComponent = ({
  competitorChartData, 
  competitors, 
  loadingCompetitors
}: DashboardChartProps) => {
  // Load persisted competitor visibility from localStorage
  const [visibleCompetitors, setVisibleCompetitors] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('llumos_competitor_toggles');
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch (e) {
      console.warn('Failed to load competitor toggle state:', e);
    }
    // Default: all competitors visible
    return new Set(competitors.map((_, index) => index));
  });
  
  // Generate colors for competitors
  const competitorColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];
  
  const toggleCompetitor = (index: number) => {
    setVisibleCompetitors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      
      // Persist to localStorage
      try {
        localStorage.setItem('llumos_competitor_toggles', JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.warn('Failed to persist competitor toggle state:', e);
      }
      
      return newSet;
    });
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Brand Presence vs Competitors</CardTitle>
          </div>
        </div>
        
        {/* Competitor Toggles */}
        {competitors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {competitors.map((competitor, index) => (
              <Button
                key={competitor.name}
                variant={visibleCompetitors.has(index) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleCompetitor(index)}
                className="text-xs"
                style={{
                  backgroundColor: visibleCompetitors.has(index) 
                    ? competitorColors[index % competitorColors.length] 
                    : undefined,
                  borderColor: competitorColors[index % competitorColors.length],
                  color: visibleCompetitors.has(index) ? '#fff' : undefined
                }}
              >
                {competitor.name}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={competitorChartData}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                label={{ value: 'Presence %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'short', 
                  day: 'numeric' 
                })}
                formatter={(value: any, name: string) => [
                  `${value}%`, 
                  name === 'orgPresence' ? 'Your Brand' : competitors[parseInt(name.replace('competitor', ''))]?.name || name
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="orgPresence" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                name="Your Brand"
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
              />
              {competitors.map((competitor, index) => 
                visibleCompetitors.has(index) ? (
                  <Line 
                    key={competitor.name}
                    type="monotone" 
                    dataKey={`competitor${index}`} 
                    stroke={competitorColors[index % competitorColors.length]} 
                    strokeWidth={2}
                    name={competitor.name}
                    dot={{ fill: competitorColors[index % competitorColors.length], strokeWidth: 1, r: 3 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized to prevent re-renders when data hasn't changed
export const DashboardChart = memo(DashboardChartComponent);