import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail } from 'lucide-react';

interface ResendEmailButtonProps {
  email: string;
}

export function ResendEmailButton({ email }: ResendEmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  const handleResend = async () => {
    if (!email || cooldown > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: "Verification email has been resent. Please check your inbox.",
      });

      // Set 60 second cooldown
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleResend}
      disabled={loading || cooldown > 0}
      className="text-sm"
    >
      <Mail className="w-4 h-4 mr-2" />
      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
    </Button>
  );
}
