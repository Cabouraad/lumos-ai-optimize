import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TrialSuccess() {
  const navigate = useNavigate();

  // Redirect to new unified payment success handler
  useEffect(() => {
    console.log('[TrialSuccess] Redirecting to unified payment-success handler');
    const search = window.location.search;
    navigate(`/payment-success${search}`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <CardTitle>Redirecting...</CardTitle>
          <CardDescription>Please wait while we redirect you</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
