import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Lock, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

type AnalysisPhase = 'idle' | 'analyzing' | 'complete';

const ANALYSIS_STEPS = [
  { text: 'Scanning ChatGPT...', duration: 800 },
  { text: 'Checking Perplexity...', duration: 700 },
  { text: 'Analyzing Gemini...', duration: 600 },
  { text: 'Measuring Sentiment...', duration: 500 },
  { text: 'Calculating Score...', duration: 400 },
];

const ScoreChecker = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const validateUrl = (input: string): boolean => {
    // Clean the input - remove protocol if present
    const cleanedInput = input.replace(/^https?:\/\//, '').trim();
    
    // Basic domain validation pattern
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainPattern.test(cleanedInput);
  };

  const handleAnalyze = () => {
    setError('');
    
    if (!url.trim()) {
      setError('Please enter a domain');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    setPhase('analyzing');
    setCurrentStep(0);
    setProgress(0);
  };

  // Handle analysis animation
  useEffect(() => {
    if (phase !== 'analyzing') return;

    const totalDuration = ANALYSIS_STEPS.reduce((acc, step) => acc + step.duration, 0);
    let elapsed = 0;

    const stepTimers: NodeJS.Timeout[] = [];
    
    ANALYSIS_STEPS.forEach((step, index) => {
      const timer = setTimeout(() => {
        setCurrentStep(index);
      }, elapsed);
      stepTimers.push(timer);
      elapsed += step.duration;
    });

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 2;
      });
    }, totalDuration / 50);

    // Complete after all steps
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      // Generate a random score between 35-85 for demo
      setScore(Math.floor(Math.random() * 50) + 35);
    }, totalDuration + 200);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
      clearInterval(progressInterval);
    };
  }, [phase]);

  const handleUnlockReport = () => {
    setShowSignupModal(true);
  };

  const handleSignup = () => {
    setShowSignupModal(false);
    navigate('/signup');
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Good Visibility';
    if (score >= 50) return 'Needs Improvement';
    return 'Low Visibility';
  };

  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />
      
      {/* Glassmorphism container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative max-w-2xl mx-auto"
      >
        <div className="backdrop-blur-xl bg-card/60 border border-border/50 rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary/20 rounded-full blur-3xl" />

          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10 text-center"
              >
                {/* Headline */}
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Check Your AI Visibility Score
                </h2>
                
                {/* Subheadline */}
                <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                  See how often ChatGPT and Gemini recommend your brand. Enter your URL below.
                </p>

                {/* Input and Button */}
                <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="example.com"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                      className={`h-14 text-lg px-5 bg-background/80 border-2 ${
                        error ? 'border-destructive' : 'border-border/50 focus:border-primary'
                      } rounded-xl`}
                    />
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-destructive text-sm mt-2 flex items-center gap-1"
                      >
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </motion.p>
                    )}
                  </div>
                  <Button
                    onClick={handleAnalyze}
                    size="lg"
                    className="h-14 px-8 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analyze Now
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 text-center py-8"
              >
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
                
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Analyzing Your Brand
                </h3>
                
                <motion.p
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-muted-foreground text-lg mb-6"
                >
                  {ANALYSIS_STEPS[currentStep]?.text}
                </motion.p>

                <div className="max-w-sm mx-auto">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
                </div>
              </motion.div>
            )}

            {phase === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
                className="relative z-10 text-center"
              >
                {/* Score Card */}
                <div className="mb-8">
                  <p className="text-muted-foreground text-sm uppercase tracking-wider mb-2">
                    Your AI Visibility Score
                  </p>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
                    className="relative inline-block"
                  >
                    <span className={`text-7xl md:text-8xl font-bold ${getScoreColor(score)}`}>
                      {score}
                    </span>
                    <span className="text-3xl text-muted-foreground">/100</span>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-2 mt-4"
                  >
                    <TrendingUp className={`h-5 w-5 ${getScoreColor(score)}`} />
                    <span className={`font-medium ${getScoreColor(score)}`}>
                      {getScoreLabel(score)}
                    </span>
                  </motion.div>
                </div>

                {/* Domain analyzed */}
                <p className="text-muted-foreground mb-6">
                  Results for <span className="font-semibold text-foreground">{url}</span>
                </p>

                {/* Unlock Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={handleUnlockReport}
                    size="lg"
                    className="h-14 px-8 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  >
                    <Lock className="mr-2 h-5 w-5" />
                    Unlock Full Report
                  </Button>
                  
                  <p className="text-sm text-muted-foreground mt-4">
                    See detailed insights, competitor analysis, and recommendations
                  </p>
                </motion.div>

                {/* Try another */}
                <button
                  onClick={() => {
                    setPhase('idle');
                    setUrl('');
                    setProgress(0);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground mt-6 underline underline-offset-4"
                >
                  Try another domain
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Unlock Your Full Report</DialogTitle>
            <DialogDescription className="text-base">
              Create a free account to access your complete AI visibility analysis, including:
            </DialogDescription>
          </DialogHeader>
          
          <ul className="space-y-3 my-4">
            {[
              'Detailed breakdown by AI platform',
              'Competitor comparison insights',
              'Actionable recommendations',
              'Weekly visibility tracking',
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={handleSignup} size="lg" className="w-full">
              Create Free Account
            </Button>
            <button
              onClick={() => setShowSignupModal(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ScoreChecker;
