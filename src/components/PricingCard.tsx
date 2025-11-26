import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight } from 'lucide-react';
import { EdgeFunctionClient } from "@/lib/edge-functions/client";
import { EnhancedEdgeFunctionClient } from "@/lib/edge-functions/enhanced-client";
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { openExternalUrl } from '@/lib/navigation';
import { isBillingBypassEligible, grantStarterBypass } from '@/lib/billing/bypass-utils';

interface PricingCardProps {
  tier: 'starter' | 'growth' | 'pro';
  title: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
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
    <Card className={`relative flex flex-col ${isPopular ? 'border-primary ring-2 ring-primary shadow-lg' : ''} ${tier === 'starter' ? 'border-primary/50' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Most Popular
        </Badge>
      )}
      {tier === 'starter' && (
        <Badge className={`absolute ${isPopular ? '-top-3 right-4' : '-top-3 left-1/2 -translate-x-1/2'} bg-primary/10 text-primary border-primary/20`}>
          🎉 Black Friday: $99/year
        </Badge>
      )}
      
      <CardHeader className="pb-4 text-center">
        <CardTitle className="text-3xl font-bold mb-2">{title}</CardTitle>
        {tier === 'starter' && (
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-2 font-semibold">
            ✓ 7-Day Free Trial
          </Badge>
        )}
        <CardDescription className="text-sm text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pt-0 text-center">
        <div className="mb-6">
          <div className="flex items-baseline gap-1 justify-center">
            <span className="text-4xl font-bold">${price}</span>
            <span className="text-muted-foreground text-sm">
              / {billingCycle === 'yearly' ? 'year' : 'month'}
            </span>
          </div>
          {billingCycle === 'yearly' && (
            <p className="text-sm text-green-600 dark:text-green-500 font-medium mt-1">
              Save 17% annually
            </p>
          )}
        </div>

        <Button
          className="w-full mb-6"
          onClick={handleSubscribe}
          disabled={loading || isCurrentTier}
          variant={isCurrentTier ? "secondary" : isPopular ? "default" : "outline"}
          size="lg"
        >
          {loading
            ? 'Loading...'
            : isCurrentTier
            ? 'Current Plan'
            : tier === 'pro'
            ? 'Book a demo'
            : 'Get started'
          }
        </Button>

        <ul className="space-y-3 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        <Link 
          to={`/plans/${tier}`} 
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          Learn more about {title} <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </CardContent>

      {retryError && (
        <CardFooter className="pt-0">
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
        </CardFooter>
      )}
      
      {!isCurrentTier && !retryError && tier === 'starter' && (
        <CardFooter className="pt-0 pb-6">
          <p className="text-xs text-muted-foreground text-center w-full">
            7-day free trial • No charge until trial ends
          </p>
        </CardFooter>
      )}
    </Card>
  );
}