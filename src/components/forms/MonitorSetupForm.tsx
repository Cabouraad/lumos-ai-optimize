import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Globe, Plus, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const formSchema = z.object({
  keyword: z.string().min(3, 'Keyword must be at least 3 characters').max(200, 'Keyword is too long'),
  platform: z.enum(['chatgpt', 'gemini', 'perplexity', 'claude', 'all']),
  competitorUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface MonitorSetupFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const MonitorSetupForm = ({ onSuccess, className }: MonitorSetupFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { user, orgData } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      keyword: '',
      platform: 'all',
      competitorUrl: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user || !orgData?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in to set up monitoring.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setIsSuccess(false);

    try {
      const { error } = await supabase.from('tracked_keywords').insert({
        user_id: user.id,
        org_id: orgData.id,
        keyword: values.keyword.trim(),
        platform: values.platform,
        competitor_url: values.competitorUrl?.trim() || null,
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already tracking",
            description: "This keyword is already being monitored on this platform.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Monitoring activated!",
        description: `We'll track "${values.keyword}" and alert you when visibility changes.`,
      });

      form.reset();
      onSuccess?.();

      // Reset success state after animation
      setTimeout(() => setIsSuccess(false), 3000);

    } catch (error: any) {
      console.error('Error setting up monitor:', error);
      toast({
        title: "Failed to set up monitoring",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Set Up AI Visibility Monitor</CardTitle>
            <CardDescription>
              Get alerts when your brand visibility drops on AI platforms
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Keyword Field */}
            <FormField
              control={form.control}
              name="keyword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Target Keyword
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., best CRM software for startups" 
                      {...field}
                      className="h-11"
                    />
                  </FormControl>
                  <FormDescription>
                    The search query or topic you want to monitor in AI responses
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Platform Selection */}
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Platform</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select platform to monitor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="chatgpt">ChatGPT</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose which AI platform(s) to track for this keyword
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Competitor URL (Optional) */}
            <FormField
              control={form.control}
              name="competitorUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Competitor URL
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., https://competitor.com" 
                      {...field}
                      className="h-11"
                    />
                  </FormControl>
                  <FormDescription>
                    Track when this competitor gains visibility for your keyword
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle className="mr-2 w-5 h-5" />
                  Monitoring Active!
                </>
              ) : (
                <>
                  <Plus className="mr-2 w-5 h-5" />
                  Start Monitoring
                </>
              )}
            </Button>
          </form>
        </Form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">How it works:</strong> We'll check AI responses daily for your keyword. 
            If your brand visibility drops or a competitor gains ground, you'll receive an instant email alert.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonitorSetupForm;
