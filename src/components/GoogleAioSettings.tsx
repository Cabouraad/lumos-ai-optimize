import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isGoogleAioAvailable } from '@/lib/providers/google-aio-adapter';

export const GoogleAioSettings: React.FC = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
      const available = await isGoogleAioAvailable();
      setIsAvailable(available);
      setIsEnabled(available);
    };

    checkAvailability();
  }, []);

  const handleToggle = (enabled: boolean) => {
    if (!isAvailable) return;
    setIsEnabled(enabled);
    // Note: Google AIO is controlled by environment variables at the server level
    // Individual org toggles can be implemented in future versions
  };

  if (isAvailable === null) {
    return null; // Loading state
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Google AI Overviews
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Beta
              </Badge>
            </CardTitle>
            <CardDescription>
              Analyze how your brand appears in Google's AI-powered search results
            </CardDescription>
          </div>
          <Switch 
            checked={isEnabled} 
            onCheckedChange={handleToggle}
            disabled={!isAvailable}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAvailable && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google AI Overviews is not currently configured. The system requires SERPAPI_KEY and ENABLE_GOOGLE_AIO=true in the environment configuration.
            </AlertDescription>
          </Alert>
        )}
        
        {isAvailable && (
          <Alert className="border-green-200 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Google AI Overviews is properly configured and available for Pro tier users.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            When enabled, Llumos will include Google AI Overview results in your visibility analysis, showing:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Brand mentions in AI-generated summaries</li>
            <li>Citation sources and competitors</li>
            <li>Weekly trend analysis for AI Overview presence</li>
          </ul>
        </div>

        <div className="pt-2 border-t">
          <a 
            href="/docs/providers/google-ai-overviews" 
            className="text-sm text-primary hover:underline flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more about Google AI Overviews
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
};