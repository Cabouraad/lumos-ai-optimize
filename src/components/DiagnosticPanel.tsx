import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface DiagnosticResult {
  ok: boolean;
  origin: string;
  allowed: boolean;
  allowList: string[];
  timestamp: string;
  environment?: {
    hasAppOrigins: boolean;
    hasAppOrigin: boolean;
    hasCronSecret: boolean;
    hasE2EFakeProviders: boolean;
  };
}

export function DiagnosticPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const runDiagnostic = async () => {
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Running CORS and edge function connectivity diagnostic...');
      
      const { data, error: invokeError } = await supabase.functions.invoke('diag');
      
      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to invoke diagnostic function');
      }
      
      setResult(data);
      
      if (data?.allowed) {
        toast({
          title: "Connectivity Test Passed",
          description: "Edge functions and CORS are configured correctly",
        });
      } else {
        toast({
          title: "Connectivity Issues Detected", 
          description: "CORS configuration may need adjustment",
          variant: "destructive"
        });
      }
      
    } catch (err: any) {
      const errorMessage = err.message || 'Diagnostic test failed';
      setError(errorMessage);
      
      toast({
        title: "Diagnostic Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      console.error('❌ Diagnostic test error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Edge Function Connectivity</CardTitle>
            <CardDescription className="text-xs">
              Test CORS and edge function connectivity
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runDiagnostic}
            disabled={loading}
            className="h-8"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Testing
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Test Connectivity
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {loading && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" />
            <span>Running connectivity test...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center space-x-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        
        {result && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              {result.allowed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                CORS Status: {result.allowed ? 'Allowed' : 'Blocked'}
              </span>
              <Badge variant={result.allowed ? 'default' : 'destructive'} className="text-xs">
                {result.allowed ? 'Pass' : 'Fail'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Origin:</span>
                <div className="font-mono break-all">{result.origin || 'Not detected'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Allowed Origins:</span>
                <div className="font-mono text-xs">{result.allowList.length} configured</div>
              </div>
            </div>
            
            {result.environment && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Environment Status:</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex items-center space-x-1">
                    <Badge variant={result.environment.hasAppOrigins ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                      {result.environment.hasAppOrigins ? '✓' : '✗'}
                    </Badge>
                    <span>APP_ORIGINS</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge variant={result.environment.hasCronSecret ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                      {result.environment.hasCronSecret ? '✓' : '✗'}
                    </Badge>
                    <span>CRON_SECRET</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge variant={result.environment.hasE2EFakeProviders ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                      {result.environment.hasE2EFakeProviders ? '✓' : '✗'}
                    </Badge>
                    <span>E2E_FAKE_PROVIDERS</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              Last tested: {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}