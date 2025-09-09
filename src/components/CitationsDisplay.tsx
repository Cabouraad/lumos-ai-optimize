import React from 'react';
import { ExternalLink, FileText, Video, File, CheckCircle, Clock, XCircle, AlertTriangle, Zap } from 'lucide-react';
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
  resolved_brand?: {
    brand: string;
    canonicalDomain: string;
    type: 'known' | 'heuristic' | 'unknown';
  };
  is_competitor?: boolean;
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

  const getDisplayName = () => {
    if (citation.resolved_brand) {
      const name = citation.resolved_brand.brand;
      // Add ~ marker for heuristic mappings
      return citation.resolved_brand.type === 'heuristic' ? `~${name}` : name;
    }
    return citation.domain;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card 
          className={`p-2 cursor-pointer hover:bg-muted/50 transition-colors max-w-xs ${
            citation.is_competitor ? 'border-red-200 bg-red-50/30' : ''
          }`}
          onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {getSourceIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <div className="font-medium text-sm truncate">
                  {getDisplayName()}
                </div>
                {citation.is_competitor && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Competitor source</p>
                    </TooltipContent>
                  </Tooltip>
                )}
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
          <div className="font-medium">{citation.title || getDisplayName()}</div>
          <div className="text-xs text-muted-foreground">
            Domain: {citation.domain}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            {citation.url}
          </div>
          {citation.resolved_brand && (
            <div className="text-xs">
              Brand: {citation.resolved_brand.brand} 
              {citation.resolved_brand.type !== 'known' && (
                <span className="text-muted-foreground"> ({citation.resolved_brand.type})</span>
              )}
            </div>
          )}
          {citation.is_competitor && (
            <div className="text-xs text-red-600">
              ⚠ Competitor source
            </div>
          )}
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