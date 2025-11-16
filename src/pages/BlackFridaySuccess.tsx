import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

const BlackFridaySuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Optional: You could verify the session with Stripe here
    console.log('Payment session:', sessionId);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-2 border-primary/20">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold">
            Welcome to Llumos!
          </CardTitle>
          <CardDescription className="text-lg">
            Your Black Friday subscription is now active
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  You're all set for one full year!
                </h3>
                <p className="text-muted-foreground">
                  Your Starter Tier subscription is active and you now have access to all features. 
                  Start tracking your AI visibility across OpenAI, Gemini, Perplexity, and Google AI.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">What's next?</h4>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Create your first prompts to start tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Monitor your brand mentions and visibility</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Analyze competitor performance</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Track citations and improve your content strategy</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => navigate('/')}
              size="lg"
              className="flex-1"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate('/prompts')}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Create First Prompt
            </Button>
          </div>

          {sessionId && (
            <p className="text-center text-xs text-muted-foreground pt-4">
              Session ID: {sessionId}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BlackFridaySuccess;
