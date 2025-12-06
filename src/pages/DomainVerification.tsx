import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle, Copy, RefreshCw, Globe, FileText, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbedBadge } from '@/components/domain/EmbedBadge';

interface Organization {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
  domain_verification_method: string | null;
}

export default function DomainVerification() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'dns' | 'file'>('dns');
  const { toast } = useToast();

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      setLoading(true);

      // Resolve organization via secure RPC (avoids auth race conditions)
      const { data: orgId, error: orgIdErr } = await supabase.rpc('get_current_user_org_id');
      if (orgIdErr || !orgId) throw new Error('No organization found');

      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('id, domain, verification_token, verified_at, domain_verification_method')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setOrg(orgData);

    } catch (error: any) {
      console.error('Error loading organization:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const regenerateToken = async () => {
    try {
      setRegenerating(true);
      
      const { data, error } = await supabase.functions.invoke('verify-domain', {
        body: { action: 'regenerate' }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'New verification token generated',
      });

      // Reload organization data
      await loadOrganization();

    } catch (error: any) {
      console.error('Error regenerating token:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
    }
  };

  const verifyDomain = async (method: 'dns' | 'file') => {
    try {
      setVerifying(true);
      
      const { data, error } = await supabase.functions.invoke('verify-domain', {
        body: { action: 'verify', method }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message,
        });
        
        // Reload organization data
        await loadOrganization();
      } else {
        toast({
          title: 'Verification Failed',
          description: data.error,
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  if (!org?.domain) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domain Verification
            </CardTitle>
            <CardDescription>
              Verify your domain to enable advanced features and security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No domain configured for your organization. Please set up your domain first in organization settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isVerified = !!org.verified_at;
  const dnsRecord = `_llumos-verify.${org.domain}`;
  const fileUrl = `https://${org.domain}/.well-known/llumos-verify.txt`;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domain Verification</h1>
          <p className="text-muted-foreground">
            Verify ownership of {org.domain} to unlock advanced features
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isVerified ? "default" : "secondary"} className="flex items-center gap-1">
            {isVerified ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Verified
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Unverified
              </>
            )}
          </Badge>
        </div>
      </div>

      {isVerified ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Domain Verified
              </CardTitle>
              <CardDescription>
                Your domain {org.domain} was verified on{' '}
                {new Date(org.verified_at!).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your domain is verified and all domain-bound features are enabled.
                  You can now invite users with matching email domains and access restricted features.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Embed Badge - Only shown after verification */}
          <EmbedBadge domain={org.domain} visibilityLevel="high" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Verification Token</CardTitle>
              <CardDescription>
                Use this token to verify domain ownership
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={org.verification_token || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(org.verification_token || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateToken}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate
                </Button>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Keep this token secure. Regenerating will invalidate the previous token.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className={selectedMethod === 'dns' ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  DNS Verification
                </CardTitle>
                <CardDescription>
                  Add a TXT record to your DNS settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>DNS Record Type</Label>
                  <Input value="TXT" readOnly className="mt-1" />
                </div>
                
                <div>
                  <Label>Name/Host</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={dnsRecord}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(dnsRecord)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label>Value</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={org.verification_token || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(org.verification_token || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => verifyDomain('dns')}
                  disabled={verifying}
                  className="w-full"
                  variant={selectedMethod === 'dns' ? 'default' : 'outline'}
                  onFocus={() => setSelectedMethod('dns')}
                >
                  {verifying && selectedMethod === 'dns' ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Verify DNS Record
                </Button>
              </CardContent>
            </Card>

            <Card className={selectedMethod === 'file' ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  File Verification
                </CardTitle>
                <CardDescription>
                  Upload a verification file to your website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>File Location</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={fileUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(fileUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label>File Content</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={org.verification_token || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(org.verification_token || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Create a file at the specified location containing only the verification token.
                    Ensure the file is accessible via HTTPS.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => verifyDomain('file')}
                  disabled={verifying}
                  className="w-full"
                  variant={selectedMethod === 'file' ? 'default' : 'outline'}
                  onFocus={() => setSelectedMethod('file')}
                >
                  {verifying && selectedMethod === 'file' ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Verify File
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What happens after verification?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• <strong>Team Invitations:</strong> Only users with matching email domains can be invited</p>
                <p>• <strong>Enhanced Security:</strong> Domain-bound resources will be protected</p>
                <p>• <strong>Brand Trust:</strong> Users will see your verified domain in the interface</p>
                <p>• <strong>Advanced Features:</strong> Unlock features that require domain verification</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}