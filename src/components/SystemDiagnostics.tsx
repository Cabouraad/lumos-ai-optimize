import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Activity, Zap, AlertTriangle } from 'lucide-react';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { validateEnvironment } from '@/lib/environment/validator';

interface SystemDiagnosticsProps {
  className?: string;
}

export function SystemDiagnostics({ className }: SystemDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      // Environment check
      const envStatus = validateEnvironment();
      
      // Circuit breaker status
      const circuitStatus = EnhancedEdgeFunctionClient.getCircuitBreakerStatus();
      
      // Try a basic connectivity test
      let connectivityTest = null;
      try {
        const result = await EnhancedEdgeFunctionClient.invoke('check-subscription', {
          timeout: 5000,
          suppressToast: true,
        });
        connectivityTest = {
          success: !result.error,
          error: result.error?.message,
          responseTime: Date.now()
        };
      } catch (error: any) {
        connectivityTest = {
          success: false,
          error: error.message,
          responseTime: null
        };
      }

      setDiagnostics({
        timestamp: new Date().toISOString(),
        environment: envStatus,
        circuitBreakers: circuitStatus,
        connectivity: connectivityTest,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        location: window.location.href
      });
    } catch (error: any) {
      console.error('Diagnostics failed:', error);
      setDiagnostics({
        timestamp: new Date().toISOString(),
        error: error.message,
        environment: validateEnvironment(),
        circuitBreakers: EnhancedEdgeFunctionClient.getCircuitBreakerStatus()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !diagnostics) {
      runDiagnostics();
    }
  }, [isOpen]);

  const getSeverityIcon = (severity: 'success' | 'warning' | 'error') => {
    switch (severity) {
      case 'success':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <Zap className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getSeverityVariant = (severity: 'success' | 'warning' | 'error') => {
    switch (severity) {
      case 'success':
        return 'default' as const;
      case 'warning':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-muted/50 cursor-pointer">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Diagnostics
              </div>
              <div className="flex items-center gap-2">
                {diagnostics && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(diagnostics.timestamp).toLocaleTimeString()}
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">System Status</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={runDiagnostics}
                disabled={loading}
              >
                {loading ? 'Running...' : 'Refresh'}
              </Button>
            </div>

            {diagnostics && (
              <div className="space-y-4">
                {/* Environment Status */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium flex items-center gap-2">
                    {getSeverityIcon(diagnostics.environment.isValid ? 'success' : 'error')}
                    Environment Configuration
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Badge variant={diagnostics.environment.isValid ? 'default' : 'destructive'}>
                      Config: {diagnostics.environment.isValid ? 'Valid' : 'Invalid'}
                    </Badge>
                    <Badge variant={diagnostics.online ? 'default' : 'destructive'}>
                      Network: {diagnostics.online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  {diagnostics.environment.errors?.length > 0 && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {diagnostics.environment.errors.join(', ')}
                    </div>
                  )}
                </div>

                {/* Connectivity Test */}
                {diagnostics.connectivity && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      {getSeverityIcon(diagnostics.connectivity.success ? 'success' : 'error')}
                      Edge Function Connectivity
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Badge variant={diagnostics.connectivity.success ? 'default' : 'destructive'}>
                        Status: {diagnostics.connectivity.success ? 'Connected' : 'Failed'}
                      </Badge>
                      {diagnostics.connectivity.responseTime && (
                        <Badge variant="outline">
                          Response: {diagnostics.connectivity.responseTime}ms
                        </Badge>
                      )}
                    </div>
                    {!diagnostics.connectivity.success && diagnostics.connectivity.error && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {diagnostics.connectivity.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Circuit Breaker Status */}
                {Object.keys(diagnostics.circuitBreakers).length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Circuit Breakers
                    </h5>
                    <div className="space-y-1">
                      {Object.entries(diagnostics.circuitBreakers).map(([name, breaker]: [string, any]) => (
                        <div key={name} className="flex items-center justify-between text-xs">
                          <span>{name}</span>
                          <Badge
                            variant={
                              breaker.state === 'CLOSED' ? 'default' :
                              breaker.state === 'HALF_OPEN' ? 'secondary' : 'destructive'
                            }
                          >
                            {breaker.state} ({breaker.failures} failures)
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technical Details */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
                  <div className="bg-muted p-2 rounded space-y-1">
                    <div>Browser: {diagnostics.userAgent?.split(' ').slice(-2).join(' ')}</div>
                    <div>URL: {diagnostics.location}</div>
                    <div>Timestamp: {diagnostics.timestamp}</div>
                    {diagnostics.environment.supabaseUrl && (
                      <div>Supabase: {new URL(diagnostics.environment.supabaseUrl).hostname}</div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {!diagnostics && !loading && (
              <div className="text-center text-muted-foreground text-sm py-4">
                Click "Refresh" to run system diagnostics
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}