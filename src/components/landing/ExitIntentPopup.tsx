import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Check if popup has been shown in this session
    const popupShown = sessionStorage.getItem('exitIntentShown');
    if (popupShown) {
      setHasShown(true);
      return;
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse is leaving from top of viewport (heading to close tab/window)
      if (e.clientY <= 0 && !hasShown) {
        setIsOpen(true);
        setHasShown(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    };

    // Add event listener after a short delay to avoid triggering on page load
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 3000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasShown]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <DialogHeader>
          <DialogTitle className="text-2xl">Wait! Before You Go...</DialogTitle>
          <DialogDescription className="text-base pt-2">
            See how your brand ranks in AI search results—completely free, no signup required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="bg-muted/50 rounded-lg p-6 space-y-3">
            <h4 className="font-semibold">Get Your Free AI Visibility Report:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>Instant visibility scores across ChatGPT, Gemini, and Perplexity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>Compare your brand against up to 3 competitors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>See where you rank in your industry</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>No email or credit card required</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button size="lg" className="w-full" asChild>
              <Link to="/free-checker" onClick={() => setIsOpen(false)}>
                Get Free Visibility Report
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              No Thanks, I&apos;ll Pass
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Join 500+ marketing teams already tracking their AI visibility
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}