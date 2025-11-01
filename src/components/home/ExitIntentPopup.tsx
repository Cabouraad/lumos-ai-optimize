import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useAnalytics } from '@/hooks/useAnalytics';

const emailSchema = z.string().email('Please enter a valid email address');

// Timing constants
const POPUP_DELAY_MS = 90000; // 90 seconds
const EXIT_INTENT_ENABLE_MS = 30000; // 30 seconds before enabling exit intent

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { trackEvent } = useAnalytics();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Global singleton guard to prevent multiple instances
    if ((window as any).__EXIT_INTENT_IN_USE) {
      return;
    }
    (window as any).__EXIT_INTENT_IN_USE = true;

    // Check if user has already seen the popup in this session
    const hasSeenPopup = sessionStorage.getItem('exitIntentShown');
    if (hasSeenPopup) {
      return;
    }

    let popupTimeoutId: NodeJS.Timeout;
    let exitIntentTimeoutId: NodeJS.Timeout;
    let isExitIntentEnabled = false;

    // Function to trigger the popup (only once)
    const trigger = () => {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        setIsOpen(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    };

    // Set timeout for automatic popup after 90 seconds
    popupTimeoutId = setTimeout(() => {
      trigger();
    }, POPUP_DELAY_MS);

    // Enable exit intent detection after 30 seconds
    exitIntentTimeoutId = setTimeout(() => {
      isExitIntentEnabled = true;
    }, EXIT_INTENT_ENABLE_MS);

    // Mouse leave handler for exit intent
    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse is leaving from the top of the viewport
      // and exit intent is enabled and hasn't already triggered
      if (e.clientY <= 0 && isExitIntentEnabled && !hasTriggeredRef.current) {
        trigger();
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearTimeout(popupTimeoutId);
      clearTimeout(exitIntentTimeoutId);
      document.removeEventListener('mouseleave', handleMouseLeave);
      delete (window as any).__EXIT_INTENT_IN_USE;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: insertError } = await supabase
        .from('leads')
        .insert({
          email: email.trim().toLowerCase(),
          source: 'exit-popup',
          metadata: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        });

      if (insertError) throw insertError;

      setIsSubmitted(true);
      
      // Track lead capture event
      trackEvent('exit_popup_lead_captured', { email: email.trim().toLowerCase() });
      
      // Track LinkedIn conversion event if pixel is loaded
      if (typeof window !== 'undefined' && (window as any).lintrk) {
        (window as any).lintrk('track', { conversion_id: 'lead_captured' });
      }
    } catch (err) {
      console.error('Error submitting lead:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !isSubmitted) {
      // User closed without submitting - don't show again this session
      sessionStorage.setItem('exitIntentShown', 'true');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!isSubmitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Don't leave your AI visibility to chance.
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                Get your free AI Visibility Report before you go.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  disabled={isSubmitting}
                  required
                />
                {error && (
                  <p className="text-sm text-destructive mt-2">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full shadow-glow"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send My Report'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                No credit card required • Instant delivery • Unsubscribe anytime
              </p>
            </form>
          </>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-primary mb-4" />
            <DialogTitle className="text-2xl font-bold mb-2">
              Check your email!
            </DialogTitle>
            <DialogDescription className="text-base">
              We've sent your free AI Visibility Report to <strong>{email}</strong>
            </DialogDescription>
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="mt-6"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
