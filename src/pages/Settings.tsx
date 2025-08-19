import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getOrgMembership } from '@/lib/org';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { SubscriptionManager } from '@/components/SubscriptionManager';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [retention, setRetention] = useState('30');

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
        .select("id,name,domain,plan_tier,domain_locked_at")
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
        
        <SubscriptionManager />

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
            {orgData.domain_locked_at ? (
              <span className="text-green-600 ml-2">Verified</span>
            ) : (
              <span className="text-muted-foreground ml-2">Unverified</span>
            )}
          </h2>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Domain</div>
            <input className="w-full border rounded-lg p-2 bg-muted" value={orgData.domain} readOnly />
          </div>
          {!orgData.domain_locked_at && (
            <div className="mt-3">
              <button 
                className="rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
                onClick={() => {
                  // Could implement verification logic here
                  alert('Domain verification not yet implemented');
                }}
              >
                Verify domain
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">LLM Providers</h2>
          <ul className="space-y-2">
            {providers.map(p => (
              <li key={p.name} className="flex items-center justify-between border rounded-lg p-2">
                <span className="text-sm capitalize">{p.name}</span>
                <span className="text-sm">{p.enabled ? "Enabled" : "Disabled"}</span>
              </li>
            ))}
            {!providers.length && <li className="text-sm text-muted-foreground">No providers found.</li>}
          </ul>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Data Retention</h2>
          <div className="text-sm">Current: {retention} days</div>
        </section>
      </div>
    </Layout>
  );
}