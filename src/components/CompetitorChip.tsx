/**
 * CompetitorChip Component
 * Displays competitor brands as branded chips with logos or initials
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Building2 } from 'lucide-react';

interface CompetitorChipProps {
  name: string;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  showLogo?: boolean;
  mentions?: number;
  confidence?: number;
  className?: string;
}

// Known competitor logos/colors mapping
const COMPETITOR_BRANDS: Record<string, { 
  color: string; 
  logoUrl?: string; 
  initials: string;
  domain?: string;
}> = {
  'hubspot': { color: 'bg-orange-500', initials: 'HS', domain: 'hubspot.com' },
  'salesforce': { color: 'bg-blue-600', initials: 'SF', domain: 'salesforce.com' },
  'zoho crm': { color: 'bg-red-500', initials: 'ZC', domain: 'zoho.com' },
  'zoho': { color: 'bg-red-500', initials: 'ZO', domain: 'zoho.com' },
  'freshworks': { color: 'bg-green-600', initials: 'FW', domain: 'freshworks.com' },
  'pipedrive': { color: 'bg-green-500', initials: 'PD', domain: 'pipedrive.com' },
  'microsoft': { color: 'bg-blue-500', initials: 'MS', domain: 'microsoft.com' },
  'google workspace': { color: 'bg-blue-400', initials: 'GW', domain: 'workspace.google.com' },
  'monday.com': { color: 'bg-purple-500', initials: 'MO', domain: 'monday.com' },
  'asana': { color: 'bg-pink-500', initials: 'AS', domain: 'asana.com' },
  'notion': { color: 'bg-gray-800', initials: 'NO', domain: 'notion.so' },
  'trello': { color: 'bg-blue-600', initials: 'TR', domain: 'trello.com' },
  'clickup': { color: 'bg-purple-600', initials: 'CU', domain: 'clickup.com' },
  'slack': { color: 'bg-purple-500', initials: 'SL', domain: 'slack.com' },
  'zoom': { color: 'bg-blue-500', initials: 'ZM', domain: 'zoom.us' },
  'intercom': { color: 'bg-blue-500', initials: 'IC', domain: 'intercom.com' },
  'zendesk': { color: 'bg-green-500', initials: 'ZD', domain: 'zendesk.com' },
  'mailchimp': { color: 'bg-yellow-500', initials: 'MC', domain: 'mailchimp.com' },
  'constant contact': { color: 'bg-blue-600', initials: 'CC', domain: 'constantcontact.com' },
  'activecampaign': { color: 'bg-blue-500', initials: 'AC', domain: 'activecampaign.com' },
  'convertkit': { color: 'bg-pink-500', initials: 'CK', domain: 'convertkit.com' },
  'klaviyo': { color: 'bg-orange-500', initials: 'KL', domain: 'klaviyo.com' },
  'marketo': { color: 'bg-purple-600', initials: 'MK', domain: 'marketo.com' },
  'pardot': { color: 'bg-blue-700', initials: 'PD', domain: 'pardot.com' },
};

// Enhanced stopwords list - terms that should never appear as competitors
const STOPWORDS = new Set([
  // Action words
  'using', 'making', 'while', 'experience', 'implementing', 'focus', 'providing',
  'when', 'than', 'better', 'improving', 'creating', 'building', 'developing',
  'analyzing', 'tracking', 'managing', 'optimizing', 'enhancing', 'boosting',
  
  // Generic business terms
  'solution', 'solutions', 'platform', 'platforms', 'software', 'tool', 'tools',
  'service', 'services', 'system', 'systems', 'application', 'applications',
  'business', 'company', 'organization', 'team', 'user', 'users', 'customer',
  'customers', 'client', 'clients', 'marketing', 'sales', 'management',
  'automation', 'integration', 'optimization', 'performance', 'analytics',
  'insights', 'data', 'content', 'digital', 'online', 'web', 'mobile', 'app',
  
  // Common words
  'the', 'and', 'or', 'but', 'for', 'with', 'by', 'from', 'to', 'in', 'on', 'at',
  'this', 'that', 'these', 'those', 'you', 'your', 'our', 'their', 'his', 'her',
  'one', 'two', 'three', 'four', 'five', 'all', 'some', 'many', 'most', 'best',
  'new', 'old', 'good', 'great', 'better', 'top', 'high', 'low', 'more', 'less',
  
  // Process words
  'process', 'processes', 'workflow', 'workflows', 'strategy', 'strategies',
  'campaign', 'campaigns', 'project', 'projects', 'feature', 'features',
  'function', 'functions', 'capability', 'capabilities', 'opportunity',
  'opportunities', 'challenge', 'challenges', 'decision', 'decisions'
]);

/**
 * Check if a competitor name is valid (not a stopword or generic term)
 */
function isValidCompetitor(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  
  // Check length
  if (normalized.length < 2 || normalized.length > 50) {
    return false;
  }
  
  // Check stopwords
  if (STOPWORDS.has(normalized)) {
    return false;
  }
  
  // Check if it's purely numeric
  if (/^[0-9]+$/.test(normalized)) {
    return false;
  }
  
  // Check for suspicious patterns
  if (normalized.includes('click here') || 
      normalized.includes('learn more') ||
      normalized.includes('find out') ||
      normalized.includes('read more')) {
    return false;
  }
  
  // Single word validation - must be substantial or known brand
  if (!normalized.includes(' ') && !normalized.includes('.') && !normalized.includes('-')) {
    // Allow known single-word brands
    if (COMPETITOR_BRANDS[normalized]) {
      return true;
    }
    
    // For other single words, be more strict
    if (normalized.length < 4) {
      return false;
    }
    
    // Check if it's a common generic word
    const genericSingleWords = [
      'marketing', 'sales', 'business', 'software', 'platform', 'solution',
      'service', 'system', 'tool', 'product', 'company', 'team', 'project',
      'campaign', 'strategy', 'process', 'management', 'development', 'design',
      'analytics', 'data', 'content', 'digital', 'online', 'mobile', 'web',
      'email', 'social', 'media', 'search', 'automation', 'integration'
    ];
    
    if (genericSingleWords.includes(normalized)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get brand information for a competitor
 */
function getBrandInfo(name: string) {
  const normalized = name.toLowerCase().trim();
  
  // Check direct match
  if (COMPETITOR_BRANDS[normalized]) {
    return COMPETITOR_BRANDS[normalized];
  }
  
  // Check partial matches for common variations
  for (const [key, brand] of Object.entries(COMPETITOR_BRANDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return brand;
    }
  }
  
  // Generate fallback initials
  const words = name.trim().split(/\s+/);
  const initials = words.length === 1 
    ? name.substring(0, 2).toUpperCase()
    : words.map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase();
  
  return {
    color: 'bg-muted-foreground',
    initials,
    domain: undefined
  };
}

export function CompetitorChip({ 
  name, 
  variant = 'outline', 
  size = 'sm',
  showLogo = true,
  mentions,
  confidence,
  className = ''
}: CompetitorChipProps) {
  const [imageError, setImageError] = useState(false);
  
  // Validate competitor name
  if (!isValidCompetitor(name)) {
    return null; // Don't render invalid competitors
  }
  
  const brandInfo = getBrandInfo(name);
  const sizeClasses = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-5 w-5 text-sm', 
    lg: 'h-6 w-6 text-base'
  };
  
  const badgeSize = size === 'sm' ? 'text-xs px-2 py-1' : 
                   size === 'md' ? 'text-sm px-3 py-1.5' : 
                   'text-base px-4 py-2';

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-medium">Detected competitor brand from AI response.</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Brand: {name}</p>
        {mentions && <p>Mentions: {mentions}</p>}
        {confidence && <p>Confidence: {Math.round(confidence * 100)}%</p>}
        {brandInfo.domain && <p>Domain: {brandInfo.domain}</p>}
      </div>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={variant} 
          className={`${badgeSize} flex items-center gap-1.5 hover:scale-105 transition-transform cursor-help ${className}`}
        >
          {showLogo && (
            <div className={`${sizeClasses[size]} rounded-full ${brandInfo.color} flex items-center justify-center text-white font-semibold`}>
              {brandInfo.logoUrl && !imageError ? (
                <img 
                  src={brandInfo.logoUrl} 
                  alt={`${name} logo`}
                  className="w-full h-full object-contain rounded-full"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-xs font-bold">
                  {brandInfo.initials}
                </span>
              )}
            </div>
          )}
          <span className="truncate max-w-24">{name}</span>
          {confidence && confidence < 0.7 && (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Render a list of competitor chips with proper filtering
 */
export function CompetitorChipList({ 
  competitors, 
  maxDisplay = 6,
  size = 'sm',
  className = ''
}: {
  competitors: (string | { name: string; mentions?: number; confidence?: number })[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  // Normalize competitors to objects and filter valid ones
  const validCompetitors = competitors
    .map(comp => typeof comp === 'string' ? { name: comp } : comp)
    .filter(comp => isValidCompetitor(comp.name))
    .slice(0, maxDisplay);

  if (validCompetitors.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Building2 className="h-4 w-4" />
        <span className="text-sm">No competitors detected.</span>
      </div>
    );
  }

  const displayedCount = Math.min(validCompetitors.length, maxDisplay);
  const remainingCount = validCompetitors.length - displayedCount;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {validCompetitors.slice(0, displayedCount).map((competitor, index) => (
        <CompetitorChip
          key={`${competitor.name}-${index}`}
          name={competitor.name}
          mentions={competitor.mentions}
          confidence={competitor.confidence}
          size={size}
          variant="outline"
        />
      ))}
      {remainingCount > 0 && (
        <Badge variant="secondary" className="text-xs px-2 py-1 text-muted-foreground">
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}

export { isValidCompetitor };