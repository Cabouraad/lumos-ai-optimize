import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { ExternalLink, Crown, Zap, Shield } from 'lucide-react';

export function SubscriptionManager() {
  const { subscriptionData, checkSubscription, orgData } = useAuth();
  const { currentTier, limits, isBypassUser } = useSubscriptionGate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activePromptsCount, setActivePromptsCount] = useState(0);

  // Resolve the correct organization ID from user data
  const orgId = orgData?.org_id || orgData?.organizations?.id;

  const fetchActivePrompts = async () => {
    if (!orgId) {
      console.log('No org_id available for fetching prompts');
      return;
    }

    console.log('Fetching active prompts for org:', orgId);

    const { count, error } = await supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('active', true);

    console.log('Active prompts count result:', { count, error });

    if (error) {
      console.error('Error fetching active prompts:', error);
      return;
    }

    setActivePromptsCount(typeof count === 'number' ? count : 0);
  };

  useEffect(() => {
    fetchActivePrompts();
  }, [orgId]);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { requestType: 'createSession' }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create customer portal session');
      }
      
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error: any) {
      console.error('Customer portal error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleRefreshSubscription = async () => {
    setLoading(true);
    await checkSubscription();
    await fetchActivePrompts();
    toast({
      title: "Subscription Refreshed",
      description: "Your subscription status has been updated.",
    });
    setLoading(false);
  };

  const handleRemoveTestAccess = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('remove-test-access');
      if (error) throw error;
      
      await checkSubscription();
      toast({
        title: "Test Access Removed",
        description: "Billing bypass has been removed from this account.",
      });
    } catch (error: any) {
      console.error('Remove test access error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove test access",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'pro':
        return <Crown className="h-5 w-5 text-purple-500" />;
      case 'growth':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'starter':
        return <Shield className="h-5 w-5 text-green-500" />;
      default:
        return <Shield className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'growth':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'starter':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Clamp progress value for reliability
  const denom = Math.max(1, limits?.promptsPerDay ?? 1);
  const usagePct = Math.min(100, Math.max(0, (activePromptsCount / denom) * 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getTierIcon(currentTier)}
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>Current Plan</span>
                <Badge className={getTierColor(currentTier)}>
                  {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                  {isBypassUser && ' (test access)'}
                </Badge>
                {isBypassUser && orgData?.role === 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveTestAccess}
                    disabled={loading}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove test access
                  </Button>
                )}
              </CardTitle>
              {subscriptionData?.subscription_end && (
                <CardDescription>
                  {subscriptionData.subscribed 
                    ? `Renews on ${new Date(subscriptionData.subscription_end).toLocaleDateString()}`
                    : `Expired on ${new Date(subscriptionData.subscription_end).toLocaleDateString()}`
                  }
                </CardDescription>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshSubscription}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-3">Prompt Usage</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Prompts</span>
                <span className="font-medium">{activePromptsCount} / {limits.promptsPerDay}</span>
              </div>
              <Progress 
                value={usagePct} 
                className={`h-2 ${usagePct >= 90 ? '[&>div]:bg-error' : usagePct >= 75 ? '[&>div]:bg-warning' : ''}`}
              />
              {usagePct >= 90 && (
                <p className="text-xs text-error">
                  ⚠️ You're at {usagePct.toFixed(0)}% of your active prompt limit. Deactivate prompts or upgrade to add more.
                </p>
              )}
              {usagePct >= 75 && usagePct < 90 && (
                <p className="text-xs text-warning">
                  You're using {usagePct.toFixed(0)}% of your active prompt limit.
                </p>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Current Plan Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm">Daily Prompts</span>
                <Badge variant="secondary">{limits.promptsPerDay}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm">AI Providers</span>
                <Badge variant="secondary">{limits.providersPerPrompt}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <span className={limits.hasRecommendations ? "text-sm" : "text-sm font-bold text-red-600"}>
                  Optimizations
                </span>
                <Badge variant={limits.hasRecommendations ? "default" : "outline"}>
                  {limits.hasRecommendations ? 'Included' : 'Not Available'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <span className={limits.hasCompetitorAnalysis ? "text-sm" : "text-sm font-bold text-red-600"}>
                  Competitor Analysis
                </span>
                <Badge variant={limits.hasCompetitorAnalysis ? "default" : "outline"}>
                  {limits.hasCompetitorAnalysis ? 'Included' : 'Not Available'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex space-x-3">
        {subscriptionData?.subscribed && (
          <Button 
            onClick={handleManageSubscription} 
            disabled={loading}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {loading ? 'Loading...' : 'Manage Subscription'}
          </Button>
        )}
        <Button 
          variant={subscriptionData?.subscribed ? "outline" : "default"} 
          onClick={() => window.open('/pricing', '_blank')}
          className="flex-1"
        >
          {subscriptionData?.subscribed ? 'Change Plan' : 'Upgrade Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}