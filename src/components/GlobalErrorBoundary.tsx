import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/observability/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorCount: number;
}

interface ErrorCategory {
  type: 'network' | 'auth' | 'render' | 'chunk' | 'unknown';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Automatic error reporting with secure logging
    logger.error('Global Error Boundary caught error', {
      component: 'GlobalErrorBoundary',
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        errorCount: this.state.errorCount + 1,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    } as any);

    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Additional error reporting could be added here
    // e.g., send to external monitoring service like Sentry
  }

  categorizeError(error?: Error): ErrorCategory {
    if (!error) {
      return {
        type: 'unknown',
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Please try again.',
        icon: <AlertTriangle className="h-12 w-12" />,
      };
    }

    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')
    ) {
      return {
        type: 'network',
        title: 'Connection Issue',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        icon: <AlertTriangle className="h-12 w-12" />,
      };
    }

    // Authentication errors
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('token')
    ) {
      return {
        type: 'auth',
        title: 'Authentication Error',
        message: 'There was a problem with your session. Please sign in again.',
        icon: <AlertTriangle className="h-12 w-12" />,
      };
    }

    // Chunk loading errors (code splitting)
    if (
      errorMessage.includes('chunk') ||
      errorMessage.includes('loading') ||
      errorMessage.includes('dynamically imported module')
    ) {
      return {
        type: 'chunk',
        title: 'Loading Error',
        message: 'Failed to load part of the application. This usually resolves with a page refresh.',
        icon: <RefreshCw className="h-12 w-12" />,
      };
    }

    // Render errors
    if (
      errorMessage.includes('render') ||
      errorMessage.includes('component') ||
      errorMessage.includes('react')
    ) {
      return {
        type: 'render',
        title: 'Display Error',
        message: 'A problem occurred while displaying this page. Our team has been notified.',
        icon: <Bug className="h-12 w-12" />,
      };
    }

    return {
      type: 'unknown',
      title: 'Unexpected Error',
      message: 'Something unexpected happened. Please try again or contact support if the issue persists.',
      icon: <AlertTriangle className="h-12 w-12" />,
    };
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const category = this.categorizeError(this.state.error);
      const isRepeatedError = this.state.errorCount > 2;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg border-destructive/50 shadow-lg">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center text-destructive">
                {category.icon}
              </div>
              <CardTitle className="text-2xl text-destructive">
                {category.title}
              </CardTitle>
              <CardDescription className="text-base">
                {category.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRepeatedError && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <p className="text-sm text-warning font-medium">
                    This error has occurred multiple times. Try returning to the home page.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {!isRepeatedError && category.type !== 'chunk' && (
                  <Button onClick={this.handleRetry} className="w-full" size="lg">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                )}
                
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Home
                </Button>
              </div>

              {this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Technical Details (for support)
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        <strong>Error:</strong> {this.state.error.message}
                      </p>
                    </div>
                    {this.state.error.stack && (
                      <div className="bg-muted p-3 rounded-md max-h-32 overflow-auto">
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Error ID: {Date.now().toString(36)}
                    </p>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
