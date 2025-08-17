import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniSparklineProps {
  data: Array<{ value: number }>;
  color?: string;
  className?: string;
}

export function MiniSparkline({ 
  data, 
  color = 'hsl(var(--primary))', 
  className = "h-8 w-16" 
}: MiniSparklineProps) {
  if (data.length === 0) {
    return <div className={`${className} bg-muted/20 rounded`} />;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}