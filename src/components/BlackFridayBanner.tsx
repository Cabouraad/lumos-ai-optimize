import { useState, useEffect } from 'react';
import { X, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function BlackFridayBanner() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    // Check if banner was dismissed in the last 24 hours
    const dismissedAt = localStorage.getItem('blackFridayBannerDismissed');
    if (dismissedAt) {
      const timeSinceDismissal = Date.now() - parseInt(dismissedAt);
      if (timeSinceDismissal < 24 * 60 * 60 * 1000) {
        return; // Don't show if dismissed less than 24 hours ago
      }
    }
    setVisible(true);

    // Calculate time left until January 1, 2026
    const endDate = new Date('2026-01-01T00:00:00');

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = endDate.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('blackFridayBannerDismissed', Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary via-primary/95 to-primary border-b border-primary/20 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Sparkles className="w-5 h-5 text-primary-foreground animate-pulse flex-shrink-0" />
            <div className="text-center sm:text-left">
              <p className="text-primary-foreground font-bold text-sm sm:text-base">
                End of Year Deal: Get Llumos for $99/year (normally $39/mo). Limited time.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary-foreground/90 text-xs sm:text-sm font-mono">
              <Clock className="w-4 h-4" />
              <span>{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s</span>
            </div>
            
            <Button 
              size="sm" 
              variant="secondary"
              className="bg-background hover:bg-background/90 text-primary font-semibold"
              asChild
            >
              <Link to="/black-friday">Start Free Trial</Link>
            </Button>
            
            <button
              onClick={handleDismiss}
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
