import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';
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
  const { user, checkSubscription } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
        // Refresh subscription status
        if (checkSubscription) {
          await checkSubscription();
        }
        return;
      }

      // Use create-trial-checkout for starter tier, create-checkout for others
      const functionName = tier === 'starter' ? 'create-trial-checkout' : 'create-checkout';
      const body = tier === 'starter' ? {} : { tier, billingCycle };
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe checkout in the same tab for reliability
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    }

    setLoading(false);
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

      <CardFooter>
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
        {tier === 'starter' && !isCurrentTier && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            No charge until trial ends
          </p>
        )}
      </CardFooter>
    </Card>
  );
}