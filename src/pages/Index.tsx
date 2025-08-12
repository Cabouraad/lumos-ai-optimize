import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user, loading, orgData } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && orgData) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user && !orgData) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Llumos</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI Search Optimization Platform - Monitor and improve your brand visibility in AI-powered search results
        </p>
        <div className="space-x-4">
          <Button asChild>
            <Link to="/auth">Get Started</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
