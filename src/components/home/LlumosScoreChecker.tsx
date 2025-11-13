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
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportRequested, setReportRequested] = useState(false);
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
                  <div className="relative inline-flex items-center justify-center mb-8">
                    {/* Radial gradient background for depth */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-48 h-48 md:w-56 md:h-56 rounded-full opacity-20 blur-3xl ${
                        scoreData.score >= 700 ? 'bg-green-500' : 
                        scoreData.score >= 600 ? 'bg-blue-500' : 
                        scoreData.score >= 500 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                    </div>
                    
                    <svg className="w-56 h-56 md:w-64 md:h-64 transform -rotate-90 relative z-10 animate-fade-in" viewBox="0 0 224 224" aria-label={`Llumos score ${scoreData.score}, ${scoreData.tier}`}>
                      {/* Outer glow circle */}
                      <circle
                        cx="112"
                        cy="112"
                        r="90"
                        stroke="currentColor"
                        strokeWidth="1"
                        fill="none"
                        className={`${getScoreColor(scoreData.score)} opacity-30 blur-sm`}
                      />
                      {/* Background circle */}
                      <circle
                        cx="112"
                        cy="112"
                        r="90"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="none"
                        className="text-muted/20"
                      />
                      {/* Progress circle with animation */}
                      <circle
                        cx="112"
                        cy="112"
                        r="90"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="none"
                        strokeDasharray={`${(scoreData.composite / 100) * 565.5} 565.5`}
                        className={`${getScoreColor(scoreData.score)} transition-all duration-1000 ease-out`}
                        strokeLinecap="round"
                        style={{
                          filter: 'drop-shadow(0 0 12px currentColor)',
                          animation: 'dash 1.5s ease-out forwards'
                        }}
                      />
                      {/* Inner shadow circle for depth */}
                      <circle
                        cx="112"
                        cy="112"
                        r="75"
                        stroke="currentColor"
                        strokeWidth="1"
                        fill="none"
                        className="text-background/50"
                      />

                      {/* Centered content INSIDE the circle (re-rotated to upright) */}
                      <g transform="rotate(90 112 112)">
                        <text
                          x="112"
                          y="112"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={`${getScoreColor(scoreData.score)} fill-current font-bold`}
                          style={{ fontSize: '68px', textShadow: '0 0 30px currentColor, 0 4px 6px rgba(0,0,0,0.3)' }}
                        >
                          {scoreData.score}
                        </text>
                        <text
                          x="112"
                          y="148"
                          textAnchor="middle"
                          className="text-muted-foreground fill-current font-semibold"
                          style={{ fontSize: '14px' }}
                        >
                          {scoreData.tier}
                        </text>
                      </g>
                    </svg>
                  </div>

                  <div className="text-center mb-6 w-full">
                    <p className="text-xl font-semibold mb-3">{scoreData.domain}</p>
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm leading-relaxed text-foreground/90">{scoreData.message}</p>
                    </div>
                    
                    {/* Display insights if available */}
                    {scoreData.insights && (
                      <div className="mt-6 text-left space-y-4">
                        {scoreData.insights.strengths.length > 0 && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                            <p className="text-base font-semibold text-primary mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              What's Working Well
                            </p>
                            <ul className="text-sm text-foreground/80 space-y-2">
                              {scoreData.insights.strengths.map((strength, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {scoreData.insights.improvements.length > 0 && (
                          <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                            <p className="text-base font-semibold text-orange-500 mb-2 flex items-center gap-2">
                              <ArrowRight className="h-4 w-4" />
                              Areas for Improvement
                            </p>
                            <ul className="text-sm text-foreground/80 space-y-2">
                              {scoreData.insights.improvements.map((improvement, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-orange-500 mt-0.5">•</span>
                                  <span>{improvement}</span>
                                </li>
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

                {/* Email Collection Form or Success Message */}
                {!reportRequested ? (
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-semibold mb-2">Get Your Free Visibility Report</h3>
                      <p className="text-sm text-muted-foreground">
                        We'll analyze your brand's AI visibility and email you a comprehensive report with actionable insights.
                      </p>
                    </div>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      
                      if (!firstName.trim()) {
                        setError('Please enter your first name');
                        return;
                      }

                      if (!email.trim() || !email.includes('@')) {
                        setError('Please enter a valid email address');
                        return;
                      }

                      setIsSubmittingReport(true);
                      setError('');

                      try {
                        const { error: invokeError } = await supabase.functions.invoke('request-visibility-report', {
                          body: { 
                            firstName: firstName.trim(),
                            email: email.trim(),
                            domain: scoreData.domain,
                            score: scoreData.score
                          },
                        });

                        if (invokeError) throw invokeError;
                        
                        setReportRequested(true);
                      } catch (err) {
                        console.error('Error requesting report:', err);
                        setError('Failed to send report request. Please try again.');
                      } finally {
                        setIsSubmittingReport(false);
                      }
                    }} className="space-y-3">
                      <Input
                        type="text"
                        placeholder="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="text-base h-12"
                        disabled={isSubmittingReport}
                        maxLength={100}
                      />
                      <Input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="text-base h-12"
                        disabled={isSubmittingReport}
                        maxLength={255}
                      />
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                          type="submit"
                          size="lg" 
                          className="flex-1 text-base shadow-glow"
                          disabled={isSubmittingReport}
                        >
                          {isSubmittingReport ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              Send Me My Free Report
                              <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            setScoreData(null);
                            setDomain('');
                            setEmail('');
                            setFirstName('');
                          }}
                          className="flex-1 text-base"
                        >
                          Check Another Domain
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Report Requested Successfully!</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Thank you, {firstName}! Our team will analyze your brand's AI visibility and send a comprehensive report to <span className="font-medium text-foreground">{email}</span> as soon as possible.
                    </p>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setScoreData(null);
                        setDomain('');
                        setEmail('');
                        setFirstName('');
                        setReportRequested(false);
                      }}
                      className="mt-4"
                    >
                      Check Another Domain
                    </Button>
                  </div>
                )}
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
