import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { validateEnvironment } from '@/lib/environment/validator';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const checkConnection = async () => {
    try {
      setStatus('checking');
      
      // First check environment
      const envStatus = validateEnvironment();
      if (!envStatus.isValid) {
        setStatus('error');
        setErrorMessage('Configuration error: ' + envStatus.errors.join(', '));
        return;
      }

      // Try to invoke a simple health check function
      const result = await EnhancedEdgeFunctionClient.invoke('check-subscription', {
        timeout: 5000
      });

      if (result.error) {
        setStatus('disconnected');
        setErrorMessage(result.error.message || 'Connection failed');
      } else {
        setStatus('connected');
        setErrorMessage('');
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Unknown error');
    } finally {
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3" />;
      case 'disconnected':
      case 'error':
        return <WifiOff className="h-3 w-3" />;
      case 'checking':
        return <AlertCircle className="h-3 w-3 animate-spin" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'connected':
        return 'default' as const;
      case 'disconnected':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      case 'checking':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const getTooltipContent = () => {
    const baseInfo = `Status: ${getStatusText()}`;
    const timeInfo = lastCheck ? `Last checked: ${lastCheck.toLocaleTimeString()}` : '';
    const errorInfo = errorMessage ? `Error: ${errorMessage}` : '';
    
    return [baseInfo, timeInfo, errorInfo].filter(Boolean).join('\n');
  };

  // Get circuit breaker status for advanced debugging
  const circuitBreakerStatus = EnhancedEdgeFunctionClient.getCircuitBreakerStatus();
  const hasOpenCircuits = Object.values(circuitBreakerStatus).some(cb => cb.state === 'OPEN');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getStatusVariant()} 
            className={`cursor-help ${className}`}
            onClick={checkConnection}
          >
            {getStatusIcon()}
            <span className="ml-1">{getStatusText()}</span>
            {hasOpenCircuits && (
              <AlertCircle className="h-3 w-3 ml-1 text-orange-500" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div>{getTooltipContent()}</div>
            {hasOpenCircuits && (
              <div className="text-orange-500 mt-1">
                Circuit breaker active - some services may be temporarily unavailable
              </div>
            )}
            <div className="text-muted-foreground mt-1">
              Click to refresh
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}