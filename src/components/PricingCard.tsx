import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { EdgeFunctionClient } from "@/lib/edge-functions/client";
import { EnhancedEdgeFunctionClient } from "@/lib/edge-functions/enhanced-client";
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openExternalUrl } from '@/lib/navigation';
import { isBillingBypassEligible, grantStarterBypass } from '@/lib/billing/bypass-utils';

interface PricingCardProps {
  tier: 'starter' | 'growth' | 'pro';
  title: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limitations: string[];
  isPopular?: boolean;
  billingCycle: 'monthly' | 'yearly';
  currentTier?: string;
}

export function PricingCard({
  tier,
  title,
  description,
  monthlyPrice,
  yearlyPrice,
  features,
  limitations,
  isPopular = false,
  billingCycle,
  currentTier,
}: PricingCardProps) {
  const { user, subscriptionData } = useAuth();
  const { hasAccessToApp } = useSubscriptionGate();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const price = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
  const isCurrentTier = currentTier === tier;
  const isFreeUser = !currentTier || currentTier === 'free';

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to a plan.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user is eligible for billing bypass (only for starter tier)
      if (tier === 'starter' && isBillingBypassEligible(user.email)) {
        await grantStarterBypass(user.email!);
        toast({
          title: "Test Access Granted",
          description: "Starter subscription activated for testing purposes.",
        });
        
        // Post-bypass entitlement check
        setLoading(true);
        let attempts = 0;
        const maxAttempts = 6;
        
        const checkEntitlement = async () => {
          while (attempts < maxAttempts) {
            await EdgeFunctionClient.checkSubscription();
            
            // Check if access is granted
            const access = hasAccessToApp();
            if (access.hasAccess) {
              navigate('/dashboard');
              return;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Failed after max attempts
          setLoading(false);
          toast({
            title: "Verification Timeout",
            description: "We couldn't verify your Starter access yet. Please try again.",
            variant: "destructive"
          });
        };
        
        checkEntitlement();
        return;
      }

      // Use create-trial-checkout for starter tier, create-checkout for others
      const functionName = tier === 'starter' ? 'create-trial-checkout' : 'create-checkout';
      const body = tier === 'starter' ? {} : { tier, billingCycle };
      
      const { data, error } = await EnhancedEdgeFunctionClient.invoke(functionName, {
        body,
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe checkout (robust across preview iframe/new tab)
        openExternalUrl(data.url);
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      // Check for authentication errors
      if (error.message?.includes('session is invalid') || 
          error.message?.includes('session is no longer valid') ||
          error.message?.includes('Authentication')) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        
        // Redirect to auth after showing toast
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create subscription",
          variant: "destructive",
        });
      }
    }

    setLoading(false);
  };

  const refreshSubscriptionWithRetry = async () => {
    setRetryError(null);
    setLoading(true);
    
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      try {
        await EdgeFunctionClient.checkSubscription();
        
        // Check if access is granted
        const access = hasAccessToApp();
        if (access.hasAccess) {
          navigate('/dashboard');
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error('Subscription check error:', error);
        break;
      }
    }
    
    // Failed after max attempts
    setLoading(false);
    setRetryError('Failed to verify subscription access');
  };

  return (
    <Card className={`relative ${isPopular ? 'border-primary ring-1 ring-primary' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Most Popular
        </Badge>
      )}
      
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
        <div className="mt-4">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-muted-foreground">
            /{billingCycle === 'yearly' ? 'year' : 'month'}
          </span>
          {billingCycle === 'yearly' && (
            <div className="text-sm text-green-600 font-medium">
              Save ~17% annually
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Features included:</h4>
            <ul className="space-y-1">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {limitations.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Not included:</h4>
              <ul className="space-y-1">
                {limitations.map((limitation, index) => (
                  <li key={index} className="flex items-center text-sm text-muted-foreground">
                    <X className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col space-y-2">
        <Button
          className="w-full"
          onClick={handleSubscribe}
          disabled={loading || isCurrentTier}
          variant={isCurrentTier ? "secondary" : isPopular ? "default" : "outline"}
        >
          {loading
            ? 'Loading...'
            : isCurrentTier
            ? 'Current Plan'
            : tier === 'starter'
            ? 'Start 7-Day Free Trial'
            : `Subscribe to ${title}`
          }
        </Button>
        
        {retryError && (
          <div className="w-full p-2 bg-destructive/10 border border-destructive/20 rounded text-center">
            <p className="text-xs text-destructive mb-1">{retryError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshSubscriptionWithRetry}
              disabled={loading}
              className="h-6 text-xs"
            >
              Try Again
            </Button>
          </div>
        )}
        
        {!isCurrentTier && !retryError && (
          <div className="w-full space-y-1">
            {tier === 'starter' && (
              <p className="text-xs text-muted-foreground text-center">
                No charge until trial ends
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs py-0 px-2">Cancel Anytime</Badge>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}