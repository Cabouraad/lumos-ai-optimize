import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function RecommendationSkeleton() {
  return (
    <Card className="rounded-2xl shadow-md h-fit">
      <CardContent className="p-6">
        {/* Header with badges */}
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>

        {/* Title */}
        <Skeleton className="h-6 w-full mb-2" />

        {/* Rationale */}
        <div className="space-y-2 mb-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        {/* Citations */}
        <div className="flex gap-1 mb-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>

        {/* Steps toggle */}
        <Skeleton className="h-5 w-24 mb-4" />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-18" />
        </div>
      </CardContent>
    </Card>
  );
}