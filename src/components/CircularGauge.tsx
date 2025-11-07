import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface CircularGaugeProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  label?: string;
}

const CircularGaugeComponent = ({
  value,
  maxValue = 10,
  size = 120,
  strokeWidth = 8,
  className = "",
  showValue = true,
  label
}: CircularGaugeProps) => {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  const data = [
    { name: 'filled', value: percentage, color: 'hsl(var(--primary))' },
    { name: 'empty', value: 100 - percentage, color: 'hsl(var(--muted))' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-success';
    if (score >= 5) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={450}
              innerRadius={size * 0.35}
              outerRadius={size * 0.45}
              paddingAngle={0}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-2xl font-bold ${getScoreColor(value)}`}>
              {value.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">/ {maxValue}</div>
          </div>
        )}
      </div>
      
      {label && (
        <div className="mt-2 text-xs text-center text-muted-foreground font-medium">
          {label}
        </div>
      )}
    </div>
  );
};

// Memoized to prevent unnecessary re-renders when value hasn't changed
export const CircularGauge = memo(CircularGaugeComponent);