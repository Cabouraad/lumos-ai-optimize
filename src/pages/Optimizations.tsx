import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { RecommendationCard } from '@/components/RecommendationCard';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Lightbulb, 
  RefreshCw
} from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  status: 'open' | 'snoozed' | 'done' | 'dismissed';
  created_at: string;
  cooldown_until?: string;
  metadata?: {
    steps?: string[];
    estLift?: number;
    sourcePromptIds?: string[];
    sourceRunIds?: string[];
    citations?: Array<{type: 'url' | 'ref', value: string}>;
    impact?: 'high' | 'medium' | 'low';
    category?: string;
    competitors?: string;
  };
}


export default function Recommendations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const { orgData } = useAuth();
  const { toast } = useToast();
  const recommendationsAccess = canAccessRecommendations();
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Show upgrade prompt if no access
  if (!recommendationsAccess.hasAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
          )}
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Visibility Optimizations</h1>
            <p className="text-muted-foreground">
              Get actionable content recommendations to improve your AI visibility
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="AI Content Recommendations"
              reason={recommendationsAccess.reason || ''}
              isTrialExpired={recommendationsAccess.isTrialExpired}
              daysRemainingInTrial={recommendationsAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadRecommendations();
    }
  }, [orgData?.organizations?.id]);

  const loadRecommendations = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      setLoading(true);
      const { data } = await supabase
        .from('recommendations')
        .select('*')
        .eq('org_id', orgData.organizations.id)
        .in('status', ['open', 'snoozed', 'done', 'dismissed'])
        .order('created_at', { ascending: false })
        .limit(20);

      setRecommendations((data || []) as Recommendation[]);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to load recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    // Enhanced orgId resolution
    const orgId = orgData?.organizations?.id ?? orgData?.org_id;
    console.log('[Generate] Resolved orgId:', orgId, 'from orgData:', orgData);
    
    if (!orgId) {
      console.warn('[Generate] No orgId found, showing error');
      toast({
        title: "Error",
        description: "Organization ID not found. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    setGenerating(true);
    console.log('[Generate] Starting recommendation generation for orgId:', orgId);
    
    try {
      // Get explicit session for auth headers
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Generate] Session available:', !!session?.access_token);
      
      // Build headers conditionally to avoid null values
      const baseHeaders = { 'Content-Type': 'application/json' };
      if (orgId) baseHeaders['x-org-id'] = orgId;
      baseHeaders['x-force-new'] = 'true';
      
      const headers = session?.access_token 
        ? { ...baseHeaders, 'Authorization': `Bearer ${session.access_token}` }
        : baseHeaders;
      
      console.log('[Generate] Invoking with headers:', Object.keys(headers));
      
      // Bulletproof invoke with explicit headers
      const { data, error } = await supabase.functions.invoke('advanced-recommendations', {
        headers,
        body: { orgId, forceNew: true }
      });

      console.log('[Generate] Response received:', { data, error });

      if (error) {
        // Retry once on auth errors
        if (error.message?.includes('401') || error.message?.includes('403')) {
          console.log('[Generate] Auth error detected, retrying with fresh session...');
          const { data: { session: freshSession } } = await supabase.auth.getSession();
          
          const retryHeaders = { 'Content-Type': 'application/json' };
          if (orgId) retryHeaders['x-org-id'] = orgId;
          retryHeaders['x-force-new'] = 'true';
          
          const finalHeaders = freshSession?.access_token 
            ? { ...retryHeaders, 'Authorization': `Bearer ${freshSession.access_token}` }
            : retryHeaders;
          
          const retryResult = await supabase.functions.invoke('advanced-recommendations', {
            headers: finalHeaders,
            body: { orgId, forceNew: true }
          });
          
          if (retryResult.error) throw retryResult.error;
          
          const retryData = retryResult.data;
          if (retryData.success) {
            const count = retryData.created || 0;
            const categories = retryData.categories_covered?.join('/') || 'various categories';
            const message = retryData.message || (count >= 8 
              ? `Generated ${count} fresh recommendations (${categories})`
              : `Generated ${count} new recommendations across ${categories}`);
              
            toast({
              title: "Success",
              description: message,
            });
          } else {
            throw new Error(retryData.error || 'Failed to generate recommendations');
          }
        } else {
          throw error;
        }
        } else if (data.success) {
          const count = data.created || 0;
          const categories = data.categories_covered?.join('/') || 'various categories';
          const message = data.message || (count >= 8 
            ? `Generated ${count} fresh recommendations (${categories})`
            : `Generated ${count} new recommendations across ${categories}`);
            
          toast({
            title: "Success", 
            description: message,
          });
        } else {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      await loadRecommendations();
    } catch (error: any) {
      console.error('[Generate] Recommendation generation error:', error);
      toast({
        title: "Error", 
        description: error.message || 'Failed to generate recommendations',
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCleanup = async () => {
    const orgId = orgData?.organizations?.id ?? orgData?.org_id;
    console.log('[Cleanup] Resolved orgId:', orgId);
    
    if (!orgId) {
      console.warn('[Cleanup] No orgId found');
      toast({
        title: "Error",
        description: "Organization ID not found. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    setCleaning(true);
    console.log('[Cleanup] Starting cleanup for orgId:', orgId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build headers conditionally to avoid null values
      const baseHeaders = { 'Content-Type': 'application/json' };
      if (orgId) baseHeaders['x-org-id'] = orgId;
      baseHeaders['x-cleanup-only'] = 'true';
      
      const headers = session?.access_token 
        ? { ...baseHeaders, 'Authorization': `Bearer ${session.access_token}` }
        : baseHeaders;
      
      console.log('[Cleanup] Invoking with headers:', Object.keys(headers));
      
      const { data, error } = await supabase.functions.invoke('advanced-recommendations', {
        headers,
        body: { orgId, cleanupOnly: true }
      });

      console.log('[Cleanup] Response received:', { data, error });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Removed ${data.deleted || 0} old recommendations; keeping most recent 20`,
        });
        await loadRecommendations();
      } else {
        throw new Error(data.error || 'Failed to cleanup recommendations');
      }
    } catch (error: any) {
      console.error('[Cleanup] Error:', error);
      toast({
        title: "Error", 
        description: error.message || 'Failed to cleanup recommendations',
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  const handleHardReset = async () => {
    const orgId = orgData?.organizations?.id ?? orgData?.org_id;
    console.log('[ResetAll] Resolved orgId:', orgId);

    if (!orgId) {
      console.warn('[ResetAll] No orgId found');
      toast({
        title: "Error",
        description: "Organization ID not found. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setCleaning(true);
    setShowResetDialog(false);
    console.log('[ResetAll] Starting hard reset for orgId:', orgId);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Build headers conditionally to avoid null values
      const baseHeaders = { 'Content-Type': 'application/json' };
      if (orgId) baseHeaders['x-org-id'] = orgId;
      baseHeaders['x-cleanup-only'] = 'true';
      baseHeaders['x-hard-reset'] = 'true';
      
      const headers = session?.access_token 
        ? { ...baseHeaders, 'Authorization': `Bearer ${session.access_token}` }
        : baseHeaders;
      
      console.log('[ResetAll] Invoking with headers:', Object.keys(headers));

      const { data, error } = await supabase.functions.invoke('advanced-recommendations', {
        headers,
        body: { orgId, cleanupOnly: true, hardReset: true }
      });

      console.log('[ResetAll] Response received:', { data, error });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Reset complete',
          description: 'Cleared all open and snoozed recommendations.',
        });
        await loadRecommendations();
      } else {
        throw new Error(data.error || 'Failed to reset recommendations');
      }
    } catch (error: any) {
      console.error('[ResetAll] Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset recommendations',
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'done' | 'dismissed', cooldownDays?: number) => {
    try {
      let updateData: any = { status };
      
      // If cooldown is specified for dismissed status, calculate cooldown_until
      if (status === 'dismissed' && cooldownDays) {
        const cooldownUntil = new Date();
        cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);
        updateData.cooldown_until = cooldownUntil.toISOString();
      }

      const { error } = await supabase
        .from('recommendations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: cooldownDays 
          ? `Recommendation snoozed for ${cooldownDays} days`
          : `Recommendation marked as ${status}`,
      });

      await loadRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredRecommendations = activeTab === 'all' 
    ? recommendations.filter(r => r.status === 'open')
    : recommendations.filter(r => r.type === activeTab && r.status === 'open');

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Recommendations</h1>
              <p className="text-muted-foreground">
                Actionable content recommendations to improve your AI visibility
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="w-3/4 h-4 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="w-full h-3 bg-muted rounded"></div>
                    <div className="w-2/3 h-3 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Visibility Optimizations</h1>
            <p className="text-muted-foreground">
              Actionable content recommendations based on your prompt performance
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCleanup}
              disabled={generating || cleaning}
              variant="outline"
              size="sm"
              aria-label="Trim old recommendations to latest 20"
            >
              {cleaning ? 'Cleaning...' : 'Trim to latest 20'}
            </Button>

            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={generating || cleaning}
                  aria-label="Reset all open and snoozed recommendations"
                >
                  Reset All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all recommendations?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all open and snoozed recommendations for your organization. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleHardReset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button 
              onClick={handleGenerateRecommendations}
              disabled={generating || cleaning}
              aria-label="Generate new recommendations"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Analyzing...' : 'Generate New'}
            </Button>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All ({recommendations.filter(r => r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="content">Content ({recommendations.filter(r => r.type === 'content' && r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="site">SEO ({recommendations.filter(r => r.type === 'site' && r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="social">Social ({recommendations.filter(r => r.type === 'social' && r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="prompt">Prompts ({recommendations.filter(r => r.type === 'prompt' && r.status === 'open').length})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {filteredRecommendations.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredRecommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        onUpdateStatus={handleUpdateStatus}
                        orgId={orgData?.organizations?.id}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No {activeTab === 'all' ? '' : activeTab} recommendations</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate new recommendations to see content suggestions for this category.
                      </p>
                      <Button 
                        onClick={handleGenerateRecommendations}
                        disabled={generating || cleaning}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        {generating ? 'Generating...' : 'Generate More'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate AI-powered content recommendations based on your prompt performance data. We'll analyze your latest visibility results to suggest specific, actionable optimizations.
              </p>
              <Button 
                onClick={handleGenerateRecommendations}
                disabled={generating || cleaning}
                variant="secondary"
                aria-label="Generate recommendations"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Analyzing Prompts...' : 'Generate Recommendations'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}