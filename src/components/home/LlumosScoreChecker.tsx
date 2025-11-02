import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { getScoreColor } from '@/hooks/useLlumosScore';
import { useAnalytics } from '@/hooks/useAnalytics';

interface DemoScoreResponse {
  score: number;
  composite: number;
  tier: string;
  domain: string;
  isDemo: boolean;
  message: string;
  insights?: {
    strengths: string[];
    improvements: string[];
  };
}

export function LlumosScoreChecker() {
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scoreData, setScoreData] = useState<DemoScoreResponse | null>(null);
  const [error, setError] = useState('');
  const { trackScoreCheck } = useAnalytics();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domain.trim()) {
      setError('Please enter your website domain');
      return;
    }

    setIsLoading(true);
    setError('');
    setScoreData(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-llumos-score-demo', {
        body: { domain: domain.trim() },
      });

      if (invokeError) throw invokeError;
      
      setScoreData(data as DemoScoreResponse);
      
      // Track the score check event
      trackScoreCheck(domain.trim());
    } catch (err) {
      console.error('Error fetching demo score:', err);
      setError('Failed to calculate score. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Check Your Llumos Score
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how your brand performs in AI search results. Get an instant visibility score.
          </p>
        </div>

        <Card className="shadow-elegant border-2">
          <CardContent className="p-6 md:p-8">
            {!scoreData ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="Enter your website domain (e.g., www.yourbrand.com)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="text-base h-12"
                    disabled={isLoading}
                  />
                  {error && (
                    <p className="text-sm text-destructive mt-2">{error}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full text-base h-12 shadow-glow"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Calculating Score...
                    </>
                  ) : (
                    <>
                      Check My Score
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Score Display */}
                <div className="flex flex-col items-center">
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <svg className="w-40 h-40 transform -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted opacity-20"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(scoreData.composite / 100) * 427.3} 427.3`}
                        className={getScoreColor(scoreData.score)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className={`text-5xl font-bold ${getScoreColor(scoreData.score)}`}>
                          {scoreData.score}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {scoreData.tier}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-6">
                    <p className="text-lg font-medium mb-1">{scoreData.domain}</p>
                    <p className="text-sm text-muted-foreground">{scoreData.message}</p>
                    
                    {/* Display insights if available */}
                    {scoreData.insights && (
                      <div className="mt-4 text-left space-y-3">
                        {scoreData.insights.strengths.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-primary mb-1">✓ Strengths:</p>
                            <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                              {scoreData.insights.strengths.map((strength, idx) => (
                                <li key={idx}>• {strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {scoreData.insights.improvements.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-orange-500 mb-1">→ Improvements:</p>
                            <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                              {scoreData.insights.improvements.map((improvement, idx) => (
                                <li key={idx}>• {improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Success Message */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Score calculated successfully</span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    size="lg" 
                    asChild 
                    className="flex-1 text-base shadow-glow"
                  >
                    <Link to="/signup">
                      Get Your Full Report
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setScoreData(null);
                      setDomain('');
                    }}
                    className="flex-1 text-base"
                  >
                    Check Another Domain
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>✓ No credit card required  •  ✓ Instant results  •  ✓ Free analysis</p>
        </div>
      </div>
    </section>
  );
}
