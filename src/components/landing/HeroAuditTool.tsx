import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SCAN_STEPS = [
  'Querying ChatGPT...',
  'Checking Perplexity...',
  'Analyzing Gemini...',
  'Analyzing Sentiment...',
];

export const HeroAuditTool = () => {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const handleScan = async () => {
    if (!domain.trim()) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setCurrentStep(0);

    // Simulate scan progress
    const stepDuration = 750; // 3 seconds total / 4 steps
    
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setCurrentStep(i);
      
      // Animate progress for this step
      const startProgress = (i / SCAN_STEPS.length) * 100;
      const endProgress = ((i + 1) / SCAN_STEPS.length) * 100;
      
      await new Promise<void>((resolve) => {
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / stepDuration, 1);
          setScanProgress(startProgress + (endProgress - startProgress) * progress);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(animate);
      });
    }

    // Navigate to results page with domain
    navigate(`/audit-results?domain=${encodeURIComponent(domain.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isScanning) {
      handleScan();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!isScanning ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter your brand website (e.g., nike.com)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-12 h-14 text-lg border-2 border-primary/20 focus:border-primary bg-background/80 backdrop-blur"
                />
              </div>
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-semibold shadow-glow whitespace-nowrap"
                onClick={handleScan}
                disabled={!domain.trim()}
              >
                Check My AI Score
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              No credit card required • Scans ChatGPT, Gemini & Perplexity
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 p-6 rounded-xl border-2 border-primary/20 bg-background/80 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-lg font-medium">{SCAN_STEPS[currentStep]}</span>
            </div>
            
            <Progress value={scanProgress} className="h-3" />
            
            <p className="text-sm text-muted-foreground">
              Analyzing <span className="font-medium text-foreground">{domain}</span> across AI platforms...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
