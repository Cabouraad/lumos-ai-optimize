import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataFreshnessIndicatorProps {
  lastUpdated: Date | null;
  className?: string;
}

export function DataFreshnessIndicator({ lastUpdated, className }: DataFreshnessIndicatorProps) {
  if (!lastUpdated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className={className}>
              <AlertCircle className="w-3 h-3 mr-1" />
              No data
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dashboard data has not been loaded yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const now = new Date();
  const timeDiff = now.getTime() - lastUpdated.getTime();
  const minutesAgo = Math.floor(timeDiff / (1000 * 60));
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));

  let displayText: string;
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let isStale = false;

  if (minutesAgo < 1) {
    displayText = "Just now";
    variant = "default";
  } else if (minutesAgo < 60) {
    displayText = `${minutesAgo}m ago`;
    variant = minutesAgo > 10 ? "secondary" : "default";
  } else if (hoursAgo < 24) {
    displayText = `${hoursAgo}h ago`;
    variant = "secondary";
    isStale = hoursAgo > 6;
  } else {
    const daysAgo = Math.floor(hoursAgo / 24);
    displayText = `${daysAgo}d ago`;
    variant = "destructive";
    isStale = true;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={className}>
            <Clock className="w-3 h-3 mr-1" />
            {displayText}
            {isStale && <AlertCircle className="w-3 h-3 ml-1" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isStale ? "Data may be stale - " : "Data last updated: "}
            {lastUpdated.toLocaleString()}
          </p>
          {isStale && (
            <p className="text-xs text-muted-foreground mt-1">
              Fresh data is generated every 6 hours
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}