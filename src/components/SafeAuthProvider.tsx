import * as React from 'react';
import { Component, ReactNode } from 'react';


interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);
    
    // Special handling for createContext errors
    if (error.message.includes('createContext') || error.message.includes('Cannot read properties of undefined')) {
      console.warn('Detected React context initialization error - this may be due to bundle loading order');
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Authentication System Error
            </h2>
            <p className="text-muted-foreground mb-6">
              There was an issue initializing the authentication system. This is usually temporary.
            </p>
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again ({this.state.retryCount + 1})
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
              >
                Reload Page
              </button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto max-h-32">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


interface SafeAuthProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SafeAuthProvider({ children }: SafeAuthProviderProps) {
  return (
    <AuthErrorBoundary>
      {children}
    </AuthErrorBoundary>
  );
}
