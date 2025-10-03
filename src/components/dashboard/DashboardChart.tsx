import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface DashboardChartProps {
  chartData: any[];
  competitorChartData: any[];
  competitors: any[];
  chartView: 'score' | 'competitors';
  onChartViewChange: (view: 'score' | 'competitors') => void;
  loadingCompetitors: boolean;
}

export function DashboardChart({ 
  chartData, 
  competitorChartData, 
  competitors, 
  chartView, 
  onChartViewChange,
  loadingCompetitors
}: DashboardChartProps) {
  // Generate colors for competitors
  const competitorColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle>
            {chartView === 'score' ? 'Visibility Trends' : 'Brand Presence vs Competitors'}
          </CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={chartView === 'score' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChartViewChange('score')}
          >
            Scores
          </Button>
          <Button
            variant={chartView === 'competitors' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChartViewChange('competitors')}
            disabled={loadingCompetitors}
          >
            Competitors
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {chartView === 'score' && (!chartData || chartData.length === 0 || !chartData.some(d => d.score != null)) ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No visibility data available yet. Run some prompts to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'score' ? (
                <LineChart data={chartData}>
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
                  domain={[0, 'dataMax + 1']}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'short', 
                    day: 'numeric' 
                  })}
                  formatter={(value: any) => [value?.toFixed(1) || '0.0', 'Average Score']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
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
                {competitors.map((competitor, index) => (
                  <Line 
                    key={competitor.name}
                    type="monotone" 
                    dataKey={`competitor${index}`} 
                    stroke={competitorColors[index % competitorColors.length]} 
                    strokeWidth={2}
                    name={competitor.name}
                    dot={{ fill: competitorColors[index % competitorColors.length], strokeWidth: 1, r: 3 }}
                  />
                ))}
              </LineChart>
            )}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}