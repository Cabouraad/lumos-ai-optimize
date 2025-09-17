/**
 * Specialized skeleton loaders for different content types
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonLoaderProps {
  className?: string;
}

export function DashboardCardSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-3 p-6 border rounded-lg", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function PromptListSkeleton({ className, count = 5 }: SkeletonLoaderProps & { count?: number }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex space-x-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-6 w-1/3" />
      <div className="h-64 flex items-end space-x-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton 
            key={index} 
            className="flex-1"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ className, rows = 5 }: SkeletonLoaderProps & { rows?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Table header */}
      <div className="flex space-x-4 p-2 border-b">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/5" />
      </div>
      
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex space-x-4 p-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/5" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
      <div className="flex space-x-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

export function ProfileSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("flex items-center space-x-4", className)}>
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function NavigationSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function MetricCardSkeleton({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export function ContentSkeleton({ 
  className, 
  lines = 3,
  showHeader = true 
}: SkeletonLoaderProps & { 
  lines?: number; 
  showHeader?: boolean; 
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {showHeader && <Skeleton className="h-6 w-1/2" />}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton 
            key={index} 
            className={cn(
              "h-4",
              index === lines - 1 ? "w-2/3" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Progressive loading component
export function ProgressiveLoader({ 
  isLoading, 
  skeleton, 
  children 
}: {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  return isLoading ? <>{skeleton}</> : <>{children}</>;
}