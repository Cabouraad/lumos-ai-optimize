import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Clock, Zap, Shield, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/UnifiedAuthProvider';

const BlackFriday = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { ready: authReady, user } = useAuth();

  const handleGetDeal = async () => {
    if (!authReady) {
      toast.error('Please wait while we load your session...');
      return;
    }

    if (!user) {
      toast.info('Please sign in to claim this deal');
      // Encode the redirect path to preserve it through auth flow
      navigate('/signin?redirect=' + encodeURIComponent('/black-friday'));
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to continue');
        navigate('/signin?redirect=/black-friday');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-bf-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        toast.success('Opening checkout... Complete your purchase in the new tab');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Check, text: 'Track AI visibility across OpenAI, Gemini, Perplexity & Google AI' },
    { icon: TrendingUp, text: 'Monitor brand mentions and competitor analysis' },
    { icon: Zap, text: 'Real-time citation tracking and performance metrics' },
    { icon: Shield, text: 'Comprehensive prompt performance insights' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 space-y-4">
          <Badge variant="secondary" className="mb-4 text-lg px-6 py-2 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-4 h-4 mr-2 inline" />
            End of Year Exclusive
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              One Year
            </span>
            <br />
            <span className="text-foreground">For Only $99</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Get full access to Llumos Starter Tier for an entire year. Save over 60% with this limited-time End of Year offer.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Limited time offer - expires soon</span>
          </div>
        </div>

        {/* Pricing Card */}
        <Card className="max-w-2xl mx-auto shadow-2xl border-2 border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader className="text-center pb-8">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-4">
                <span className="text-4xl font-bold line-through text-muted-foreground">
                  $240
                </span>
                <Badge variant="default" className="text-xl px-4 py-2 bg-primary text-primary-foreground">
                  Save $141
                </Badge>
              </div>
              <CardTitle className="text-6xl font-bold text-primary">
                $99
              </CardTitle>
              <CardDescription className="text-lg">
                For one full year • Starter Tier
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Features List */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Everything you need:</h3>
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-1 shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-muted-foreground">{feature.text}</p>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleGetDeal}
              disabled={isLoading}
              size="lg"
              className="w-full text-lg py-6 bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Claim Your End of Year Deal
                </div>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Secure checkout powered by Stripe • Cancel anytime
            </p>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Instant Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Limited Time</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlackFriday;
