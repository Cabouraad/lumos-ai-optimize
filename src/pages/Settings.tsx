import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, Copy } from 'lucide-react';

export default function Settings() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settings, setSettings] = useState({
    industry: '',
    keywords: '',
    competitors: '',
    retention: '30'
  });
  const [providers, setProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const organization = orgData?.organizations;
  const isVerified = !!organization?.domain_locked_at;

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadSettings();
      loadProviders();
      if (!isVerified) {
        loadVerificationToken();
      }
    }
  }, [orgData, isVerified]);

  const loadSettings = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      // Load retention setting from recommendations table
      const { data: retentionData } = await supabase
        .from('recommendations')
        .select('rationale')
        .eq('org_id', orgData.organizations.id)
        .eq('title', 'RETENTION')
        .maybeSingle();

      setSettings(prev => ({
        ...prev,
        retention: retentionData?.rationale || '30'
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const { data } = await supabase
        .from('llm_providers')
        .select('*')
        .order('name');
      
      setProviders(data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadVerificationToken = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      const { data } = await supabase
        .from('recommendations')
        .select('rationale')
        .eq('org_id', orgData.organizations.id)
        .eq('type', 'site')
        .eq('title', 'DOMAIN_TOKEN')
        .maybeSingle();

      if (data?.rationale) {
        setVerificationToken(data.rationale);
      } else {
        // Generate new token
        const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        await supabase
          .from('recommendations')
          .insert({
            org_id: orgData.organizations.id,
            type: 'site',
            title: 'DOMAIN_TOKEN',
            rationale: newToken,
            status: 'open'
          });
        
        setVerificationToken(newToken);
      }
    } catch (error) {
      console.error('Error loading verification token:', error);
    }
  };

  const handleDomainVerification = async () => {
    if (!orgData?.organizations?.id) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-domain', {
        body: { orgId: orgData.organizations.id }
      });

      if (error) throw error;

      if (data.verified) {
        toast({
          title: "Domain Verified!",
          description: `Domain verified successfully via ${data.method}`,
        });
        // Refresh page data
        window.location.reload();
      } else {
        toast({
          title: "Verification Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleProviderToggle = async (providerId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('llm_providers')
        .update({ enabled })
        .eq('id', providerId);

      if (error) throw error;

      setProviders(prev => 
        prev.map(p => p.id === providerId ? { ...p, enabled } : p)
      );

      toast({
        title: "Success",
        description: "Provider settings updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRetentionChange = async (retention: string) => {
    if (!orgData?.organizations?.id) return;

    try {
      // Update or insert retention setting
      const { data: existing } = await supabase
        .from('recommendations')
        .select('id')
        .eq('org_id', orgData.organizations.id)
        .eq('title', 'RETENTION')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('recommendations')
          .update({ rationale: retention })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('recommendations')
          .insert({
            org_id: orgData.organizations.id,
            type: 'site',
            title: 'RETENTION',
            rationale: retention,
            status: 'open'
          });
      }

      setSettings(prev => ({ ...prev, retention }));

      toast({
        title: "Success",
        description: "Data retention setting updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization and domain verification
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Basic organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input 
                    value={organization?.name || ''} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan Tier</Label>
                  <Input 
                    value={organization?.plan_tier || ''} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Domain Verification
                {isVerified ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Verify domain ownership to enable advanced features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Input 
                  value={organization?.domain || ''} 
                  disabled={isVerified}
                  className={isVerified ? "bg-muted" : ""}
                />
                {isVerified && (
                  <p className="text-sm text-muted-foreground">
                    Domain is locked and cannot be changed after verification.
                  </p>
                )}
              </div>

              {!isVerified && verificationToken && (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-medium">File Verification Method</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      To verify your domain, create the following file on your website:
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>File Path</Label>
                    <div className="flex items-center space-x-2">
                      <div className="font-mono text-sm bg-background p-2 rounded border flex-1">
                        /.well-known/llumos-verify.txt
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard('/.well-known/llumos-verify.txt')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>File Content</Label>
                    <div className="flex items-center space-x-2">
                      <div className="font-mono text-sm bg-background p-2 rounded border flex-1">
                        {verificationToken}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(verificationToken)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button onClick={handleDomainVerification} disabled={verifying}>
                      {verifying ? 'Verifying...' : 'Verify Domain'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LLM Providers</CardTitle>
              <CardDescription>Enable or disable AI providers for prompt analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProviders ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium capitalize">{provider.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          AI provider for brand extraction
                        </p>
                      </div>
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={(checked) => handleProviderToggle(provider.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
              <CardDescription>How long to keep historical data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { value: '7', label: '7 days' },
                  { value: '30', label: '30 days' },
                  { value: '90', label: '90 days' }
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`retention-${option.value}`}
                      name="retention"
                      value={option.value}
                      checked={settings.retention === option.value}
                      onChange={(e) => handleRetentionChange(e.target.value)}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`retention-${option.value}`} className="text-sm">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}