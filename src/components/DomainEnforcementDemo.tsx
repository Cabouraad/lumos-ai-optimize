import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Shield, Users, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface DomainStatus {
  hasFeatureFlag: boolean;
  isDomainVerified: boolean;
  orgDomain: string | null;
  verifiedAt: string | null;
}

export function DomainEnforcementDemo() {
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [emailValidation, setEmailValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDomainStatus();
  }, []);

  const loadDomainStatus = async () => {
    try {
      setLoading(true);
      
      // Get current user's organization
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.org_id) return;

      // Get organization details
      const { data: orgData } = await supabase
        .from('organizations')
        .select('domain, verified_at')
        .eq('id', userData.org_id)
        .single();

      // Check feature flag
      const { data: flagData } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('flag_name', 'domain_verification_bypass')
        .single();

      setDomainStatus({
        hasFeatureFlag: flagData?.enabled || false,
        isDomainVerified: !!orgData?.verified_at,
        orgDomain: orgData?.domain || null,
        verifiedAt: orgData?.verified_at || null
      });

    } catch (error) {
      console.error('Error loading domain status:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateTestEmail = async () => {
    if (!testEmail || !domainStatus) return;

    try {
      setValidating(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.org_id) return;

      // Call validation function
      const { data, error } = await supabase.rpc('validate_domain_invitation', {
        p_org_id: userData.org_id,
        p_email: testEmail
      });

      if (error) throw error;

      setEmailValidation(data);

    } catch (error: any) {
      console.error('Error validating email:', error);
      toast({
        title: 'Validation Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            Loading domain status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!domainStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load domain verification status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Domain Enforcement Status
          </CardTitle>
          <CardDescription>
            Current domain verification and enforcement settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Feature Flag Bypass</span>
                <Badge variant={domainStatus.hasFeatureFlag ? "secondary" : "default"}>
                  {domainStatus.hasFeatureFlag ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Domain Verification</span>
                <Badge variant={domainStatus.isDomainVerified ? "default" : "secondary"}>
                  {domainStatus.isDomainVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Organization Domain</span>
                <p className="text-sm text-muted-foreground">
                  {domainStatus.orgDomain || "No domain configured"}
                </p>
              </div>
              {domainStatus.verifiedAt && (
                <div>
                  <span className="text-sm font-medium">Verified At</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(domainStatus.verifiedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {domainStatus.hasFeatureFlag ? (
                <>
                  <strong>Development Mode:</strong> Domain verification is bypassed. 
                  All features are accessible regardless of domain verification status.
                </>
              ) : (
                <>
                  <strong>Production Mode:</strong> Domain verification is enforced. 
                  {domainStatus.isDomainVerified 
                    ? "Your domain is verified and all features are accessible."
                    : "Verify your domain to unlock protected features and invitations."
                  }
                </>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invitation Email Validation
          </CardTitle>
          <CardDescription>
            Test domain-based email validation for team invitations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email to validate (e.g., user@example.com)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              type="email"
            />
            <Button 
              onClick={validateTestEmail}
              disabled={validating || !testEmail}
            >
              {validating ? "Validating..." : "Validate"}
            </Button>
          </div>

          {emailValidation && (
            <Alert>
              {emailValidation.valid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                <strong>
                  {emailValidation.valid ? "✅ Valid" : "❌ Invalid"}:
                </strong>{" "}
                {emailValidation.reason}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Test scenarios:</strong></p>
            {domainStatus.orgDomain ? (
              <>
                <p>• user@{domainStatus.orgDomain} → Should be valid if domain is verified</p>
                <p>• user@example.com → Should be invalid if domain is verified and bypass is disabled</p>
              </>
            ) : (
              <p>• Any email → Should be valid when no domain is configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Access Control Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              {domainStatus.hasFeatureFlag || domainStatus.isDomainVerified ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div>
                <p className="font-medium">Prompts & Optimizations</p>
                <p className="text-muted-foreground">
                  {domainStatus.hasFeatureFlag || domainStatus.isDomainVerified
                    ? "Full access to create and manage prompts and optimizations"
                    : "Limited access - domain verification required for full functionality"
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {domainStatus.hasFeatureFlag || 
              (domainStatus.isDomainVerified && domainStatus.orgDomain) ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div>
                <p className="font-medium">Team Invitations</p>
                <p className="text-muted-foreground">
                  {domainStatus.hasFeatureFlag
                    ? "Can invite users from any domain (bypass enabled)"
                    : domainStatus.isDomainVerified && domainStatus.orgDomain
                    ? `Can invite users from @${domainStatus.orgDomain}`
                    : !domainStatus.orgDomain
                    ? "Can invite users from any domain (no domain configured)"
                    : "Must verify domain before sending invitations"
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {domainStatus.hasFeatureFlag || domainStatus.isDomainVerified ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div>
                <p className="font-medium">Advanced Features</p>
                <p className="text-muted-foreground">
                  {domainStatus.hasFeatureFlag || domainStatus.isDomainVerified
                    ? "Access to all premium features and integrations"
                    : "Some features may be restricted until domain is verified"
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}