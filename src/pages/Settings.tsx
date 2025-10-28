import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { getOrgMembership } from '@/lib/org';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { SubscriptionManager } from '@/components/SubscriptionManager';
import { TrialBanner } from '@/components/TrialBanner';
import { GoogleAioSettings } from '@/components/GoogleAioSettings';
import { DomainEnforcementDemo } from '@/components/DomainEnforcementDemo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { getAllowedProviders, type ProviderName, type SubscriptionTier } from '@/lib/providers/tier-policy';
import { Bot, Search, Sparkles, Globe } from 'lucide-react';
import { signOutWithCleanup } from '@/lib/auth-cleanup';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccessToApp } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [retention, setRetention] = useState('30');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettingsData();
    }
  }, [user]);

  const loadSettingsData = async () => {
    try {
      // Check org membership
      const membership = await getOrgMembership();
      if (!membership) {
        setLoading(false);
        return;
      }

      // Load org data
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .select("id,name,domain,plan_tier,verified_at")
        .eq("id", membership.org_id)
        .single();

      if (orgErr) throw new Error(`Failed to load organization: ${orgErr.message}`);

      // Load providers
      const { data: providersData, error: provErr } = await supabase
        .from("llm_providers")
        .select("name, enabled")
        .order("name");

      if (provErr) throw new Error(`Failed to load providers: ${provErr.message}`);

      // Load retention setting
      const { data: retentionData } = await supabase
        .from("recommendations")
        .select("rationale")
        .eq("org_id", org.id)
        .eq("title", "RETENTION")
        .maybeSingle();

      setOrgData(org);
      setProviders(providersData || []);
      setRetention(retentionData?.rationale || '30');
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.')) {
      return;
    }

    if (!confirm('This will permanently delete your account and all associated data. Type "DELETE" to confirm.')) {
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Account Deleted",
          description: "Your account has been permanently deleted.",
        });
        
        // Sign out and redirect with cleanup
        signOutWithCleanup();
      } else {
        throw new Error(data.error || 'Deletion failed');
      }
    } catch (error: any) {
      console.error('Account deletion error:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <div className="mt-4 rounded-xl border p-4 text-destructive">
            {error}
          </div>
        </div>
      </Layout>
    );
  }

  if (!orgData) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <div className="rounded-xl border p-4">
            <div className="font-medium mb-1">Onboarding incomplete</div>
            <p className="text-sm text-muted-foreground">
              You haven't created an organization yet. Complete setup to configure your domain and providers.
            </p>
            <Link 
              to="/onboarding" 
              className="inline-block mt-3 rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
            >
              Go to Onboarding
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-8">
        <h1 className="text-3xl font-semibold">Settings</h1>
        
        {/* Trial banner if user is on trial */}
        {appAccess.daysRemainingInTrial && appAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={appAccess.daysRemainingInTrial} />
        )}
        
        <SubscriptionManager />

        {/* Domain Enforcement Demo */}
        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Domain Security Status</h2>
          <DomainEnforcementDemo />
        </section>

        {/* LLM Providers */}
        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">LLM Providers</h2>
          <div className="space-y-3">
            {/* Show all providers with tier information */}
            {['openai', 'perplexity', 'gemini', 'google_ai_overview'].map((providerName) => {
              const provider = providers.find(p => p.name === providerName);
              const isEnabled = provider?.enabled ?? false;
              
              // Determine which tier this provider requires
              const tierRequirements = {
                'openai': 'All tiers',
                'perplexity': 'Starter+',
                'gemini': 'Growth+',
                'google_ai_overview': 'Pro only'
              };
              
              const currentTier = orgData?.plan_tier || 'starter';
              const allowedProviders = getAllowedProviders(currentTier as SubscriptionTier);
              const isAllowedForCurrentTier = allowedProviders.includes(providerName as ProviderName);
              
              return (
                <div key={providerName} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {/* Provider icon */}
                    {providerName === 'openai' && <Bot className="h-4 w-4 text-emerald-600" />}
                    {providerName === 'perplexity' && <Search className="h-4 w-4 text-blue-600" />}
                    {providerName === 'gemini' && <Sparkles className="h-4 w-4 text-purple-600" />}
                    {providerName === 'google_ai_overview' && <Globe className="h-4 w-4 text-orange-600" />}
                    
                    <span className="text-sm capitalize font-medium">
                      {providerName === 'google_ai_overview' ? 'Google AI Overviews' : providerName}
                    </span>
                    <Badge variant={isAllowedForCurrentTier ? "default" : "secondary"} className="text-xs">
                      {tierRequirements[providerName as keyof typeof tierRequirements]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {!isAllowedForCurrentTier && (
                      <Badge variant="outline" className="text-xs">
                        Upgrade Required
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {providers.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 border rounded-lg">
                No providers configured in database.
              </div>
            )}
          </div>
        </section>


        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Organization</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Organization Name</div>
              <input className="w-full border rounded-lg p-2 bg-muted" value={orgData.name} readOnly />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Plan Tier</div>
              <input className="w-full border rounded-lg p-2 bg-muted" value={orgData.plan_tier} readOnly />
            </div>
          </div>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">
            Domain Verification 
            {orgData.verified_at ? (
              <span className="text-green-600 ml-2">✓ Verified</span>
            ) : (
              <span className="text-muted-foreground ml-2">Unverified</span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Domain</div>
              <input className="w-full border rounded-lg p-2 bg-muted" value={orgData.domain} readOnly />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <input 
                className="w-full border rounded-lg p-2 bg-muted" 
                value={orgData.verified_at ? `Verified on ${new Date(orgData.verified_at).toLocaleDateString()}` : 'Not verified'} 
                readOnly 
              />
            </div>
          </div>
          <div className="mt-3">
            <Link 
              to="/domain-verification"
              className="inline-block rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
            >
              {orgData.verified_at ? 'Manage Verification' : 'Verify Domain'}
            </Link>
          </div>
        </section>


        {/* Google AI Overviews Integration */}
        <GoogleAioSettings />

        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Data Retention</h2>
          <div className="text-sm">Current: {retention} days</div>
        </section>

        <section className="rounded-xl border border-destructive/20 p-4">
          <h2 className="font-medium mb-3 text-destructive">Danger Zone</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Delete Account</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}