import React from 'react';
import { ExternalLink, FileText, Video, File, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export interface Citation {
  url: string;
  domain: string;
  title?: string;
  source_type: 'page' | 'pdf' | 'video' | 'unknown';
  from_provider: boolean;
  brand_mention: 'unknown' | 'yes' | 'no';
  brand_mention_confidence: number;
}

interface CitationsDisplayProps {
  citations?: Citation[];
  provider: string;
  isCompact?: boolean;
}

export function CitationsDisplay({ citations, provider, isCompact = false }: CitationsDisplayProps) {
  if (!citations || citations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No provider citations available
      </div>
    );
  }

  const visibleCitations = isCompact ? citations.slice(0, 3) : citations;
  const remainingCount = isCompact ? Math.max(0, citations.length - 3) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ExternalLink className="h-4 w-4" />
          Sources ({citations.length})
        </div>
        
        <div className={`flex flex-wrap gap-2 ${isCompact ? 'max-h-20 overflow-hidden' : ''}`}>
          {visibleCitations.map((citation, index) => (
            <CitationChip key={index} citation={citation} />
          ))}
          
          {remainingCount > 0 && (
            <Badge variant="secondary" className="cursor-pointer">
              +{remainingCount} more
            </Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  const getSourceIcon = () => {
    switch (citation.source_type) {
      case 'pdf':
        return <FileText className="h-3 w-3" />;
      case 'video':
        return <Video className="h-3 w-3" />;
      default:
        return <File className="h-3 w-3" />;
    }
  };

  const getBrandMentionBadge = () => {
    switch (citation.brand_mention) {
      case 'yes':
        return (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            <CheckCircle className="h-3 w-3 mr-1" />
            Mentions brand
          </Badge>
        );
      case 'no':
        return (
          <Badge variant="outline" className="text-gray-500">
            <XCircle className="h-3 w-3 mr-1" />
            No brand mention
          </Badge>
        );
      case 'unknown':
      default:
        return (
          <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">
            <Clock className="h-3 w-3 mr-1" />
            Checking...
          </Badge>
        );
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card 
          className="p-2 cursor-pointer hover:bg-muted/50 transition-colors max-w-xs"
          onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {getSourceIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {citation.domain}
              </div>
              {citation.title && (
                <div className="text-xs text-muted-foreground truncate">
                  {citation.title}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {getBrandMentionBadge()}
                {!citation.from_provider && (
                  <Badge variant="outline" className="text-xs">
                    Discovered
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1">
          <div className="font-medium">{citation.title || citation.domain}</div>
          <div className="text-xs text-muted-foreground break-all">
            {citation.url}
          </div>
          {citation.brand_mention !== 'unknown' && (
            <div className="text-xs">
              Brand mention confidence: {Math.round(citation.brand_mention_confidence * 100)}%
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}