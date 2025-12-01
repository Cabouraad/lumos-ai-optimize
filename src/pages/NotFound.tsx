import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, Home, ArrowLeft, HelpCircle } from 'lucide-react';
import { SEOHelmet } from '@/components/SEOHelmet';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
      <SEOHelmet
        title="Page Not Found - 404"
        description="The page you're looking for doesn't exist. Return to Llumos homepage to track your brand's AI search visibility."
        canonicalPath="/404"
      />
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="container max-w-lg px-4">
          <Card className="p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
            <h2 className="text-xl font-semibold text-foreground mb-4">Page Not Found</h2>
            <p className="text-muted-foreground mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link to="/">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Homepage
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/pricing">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  View Pricing
                </Link>
              </Button>
            </div>
            
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground mb-3">Looking for something specific?</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/features">Features</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/demo">Demo</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default NotFound;
