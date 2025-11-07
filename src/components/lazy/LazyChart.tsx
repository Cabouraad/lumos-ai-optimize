import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Lazy chart wrapper for code-splitting recharts
 * Note: Direct imports from 'recharts' are used in components
 * This wrapper adds Suspense boundaries for better loading states
 */

/**
 * Chart loading fallback component
 */
function ChartFallback({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

/**
 * Wrapper component that adds Suspense to any chart
 */
export function LazyChartWrapper({ 
  children, 
  height = 300 
}: { 
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Suspense fallback={<ChartFallback height={height} />}>
      {children}
    </Suspense>
  );
}
