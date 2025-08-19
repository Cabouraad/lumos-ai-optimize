import { Layout } from '@/components/Layout';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';

export default function Dashboard() {
  const { hasAccessToApp, isOnTrial, daysRemainingInTrial } = useSubscriptionGate();
  const appAccess = hasAccessToApp();

  // Block access if trial expired
  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="max-w-md mx-auto text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Trial Expired</h2>
              <p className="text-red-600 mb-4">
                Your 7-day free trial has ended. Upgrade to continue using Llumos.
              </p>
              <button 
                onClick={() => window.location.href = '/pricing'}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Upgrade to Continue
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Show trial banner if user is on trial */}
        {isOnTrial && daysRemainingInTrial && daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={daysRemainingInTrial} />
        )}
        
        {/* Original dashboard content */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your Llumos dashboard
          </p>
        </div>
        
        {/* Dashboard content would go here */}
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">Dashboard Available</h3>
          <p className="text-muted-foreground">
            Access your visibility insights and analytics.
          </p>
        </div>
      </div>
    </Layout>
  );
}