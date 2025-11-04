import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ClusterTagBadgeProps {
  tag: string | null;
  className?: string;
}

const tagColorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  green: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
  purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  pink: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
};

function getTagColor(tag: string): string {
  // Simple hash function to consistently map tags to colors
  const hash = tag.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const colorKeys = Object.keys(tagColorMap);
  const colorIndex = Math.abs(hash) % colorKeys.length;
  return tagColorMap[colorKeys[colorIndex]];
}

export function ClusterTagBadge({ tag, className }: ClusterTagBadgeProps) {
  if (!tag) {
    return null;
  }

  const colorClass = getTagColor(tag);

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-xs font-medium',
        colorClass,
        className
      )}
    >
      {tag}
    </Badge>
  );
}
