import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  chunkName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk loading error
    const isChunkError = error.message.includes('Loading chunk') || 
                        error.message.includes('dynamically imported module') ||
                        error.message.includes('Failed to fetch');
    
    return { hasError: isChunkError, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo);
    
    // Log chunk loading errors specifically
    if (error.message.includes('dynamically imported module')) {
      console.error('Chunk loading failed for:', this.props.chunkName || 'unknown chunk');
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      retryCount: prevState.retryCount + 1
    }));
    
    // Force reload the page if retry count is high
    if (this.state.retryCount >= 2) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Loading Error
            </h1>
            <p className="text-muted-foreground mb-6">
              {this.state.retryCount >= 2 
                ? "We're having trouble loading this page. The page will refresh to try again."
                : "Failed to load the page content. This might be a temporary network issue."
              }
            </p>
            <Button onClick={this.handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {this.state.retryCount >= 2 ? 'Refresh Page' : 'Try Again'}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}