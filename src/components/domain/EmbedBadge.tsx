import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmbedBadgeProps {
  domain: string;
  visibilityLevel?: 'high' | 'medium' | 'low';
}

export function EmbedBadge({ domain, visibilityLevel = 'high' }: EmbedBadgeProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Badge image URL - using a data URI for the badge
  const badgeDataUri = generateBadgeDataUri(visibilityLevel);
  
  const embedCode = `<a href="https://llumos.app?ref=${encodeURIComponent(domain)}" target="_blank" rel="noopener noreferrer">
  <img src="${badgeDataUri}" alt="Llumos Verified - AI Visibility: ${visibilityLevel.charAt(0).toUpperCase() + visibilityLevel.slice(1)}" width="200" height="32" />
</a>`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Embed code copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Embed Badge
        </CardTitle>
        <CardDescription>
          Display your verified status on your website
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badge Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-center">
            <BadgePreview visibilityLevel={visibilityLevel} />
          </div>
        </div>

        {/* Embed Code */}
        <div className="space-y-2">
          <p className="text-sm font-medium">HTML Embed Code</p>
          <Textarea
            value={embedCode}
            readOnly
            className="font-mono text-xs h-24 resize-none"
          />
          <Button
            onClick={copyToClipboard}
            variant="outline"
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Embed Code
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Add this badge to your website footer or about page to showcase your AI visibility verification.
        </p>
      </CardContent>
    </Card>
  );
}

function BadgePreview({ visibilityLevel }: { visibilityLevel: 'high' | 'medium' | 'low' }) {
  const levelColors = {
    high: 'text-emerald-500',
    medium: 'text-amber-500',
    low: 'text-red-500',
  };

  const levelBg = {
    high: 'bg-emerald-500/10',
    medium: 'bg-amber-500/10',
    low: 'bg-red-500/10',
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-full shadow-sm">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="text-primary"
      >
        <path
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-semibold text-foreground">Llumos Verified</span>
      <span className="text-muted-foreground">|</span>
      <span className={`text-xs font-medium ${levelColors[visibilityLevel]}`}>
        AI Visibility: {visibilityLevel.charAt(0).toUpperCase() + visibilityLevel.slice(1)}
      </span>
    </div>
  );
}

function generateBadgeDataUri(visibilityLevel: 'high' | 'medium' | 'low'): string {
  const levelColor = {
    high: '#10b981',
    medium: '#f59e0b',
    low: '#ef4444',
  }[visibilityLevel];

  const levelText = visibilityLevel.charAt(0).toUpperCase() + visibilityLevel.slice(1);

  // SVG badge
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="32" viewBox="0 0 200 32">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="100%" style="stop-color:#16162a"/>
      </linearGradient>
    </defs>
    <rect width="200" height="32" rx="16" fill="url(#bg)"/>
    <rect x="0.5" y="0.5" width="199" height="31" rx="15.5" fill="none" stroke="#333" stroke-opacity="0.5"/>
    <path d="M16 8l-6 3 6 3 6-3-6-3zM10 17l6 3 6-3M10 14l6 3 6-3" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="28" y="17" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#ffffff">Llumos Verified</text>
    <text x="104" y="17" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#888">|</text>
    <text x="114" y="17" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${levelColor}">AI Visibility: ${levelText}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
