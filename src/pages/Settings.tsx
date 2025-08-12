import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [verificationToken] = useState(() => 
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  );

  const organization = orgData?.organizations;
  const isVerified = !!organization?.domain_locked_at;

  const handleDomainVerification = () => {
    toast({
      title: "Domain Verification",
      description: "Domain verification scanning will be implemented in the next phase.",
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
                  <Badge variant="default">Verified</Badge>
                ) : (
                  <Badge variant="secondary">Unverified</Badge>
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

              {!isVerified && (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-medium">File Verification Method</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      To verify your domain, create the following file on your website:
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>File Path</Label>
                    <div className="font-mono text-sm bg-background p-2 rounded border">
                      /.well-known/llumos-verify.txt
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>File Content</Label>
                    <div className="font-mono text-sm bg-background p-2 rounded border">
                      {verificationToken}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button onClick={handleDomainVerification}>
                      Verify Domain
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Usage</CardTitle>
              <CardDescription>Monitor your LLM provider usage and costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No usage data available yet.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}