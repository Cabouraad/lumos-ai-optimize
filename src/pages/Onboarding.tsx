import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const { user, orgData } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    domain: '',
    industry: '',
    keywords: '',
    competitors: ''
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (orgData) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.orgName,
          domain: formData.domain,
          plan_tier: 'starter',
          domain_verification_method: 'file'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          org_id: org.id,
          role: 'owner',
          email: user.email!
        });

      if (userError) throw userError;

      // Create organization's brand in catalog
      const { error: brandError } = await supabase
        .from('brand_catalog')
        .insert({
          org_id: org.id,
          name: formData.orgName,
          variants_json: [],
          is_org_brand: true
        });

      if (brandError) throw brandError;

      toast({
        title: "Welcome to Llumos!",
        description: "Your organization has been set up successfully.",
      });

      // Force refresh auth context
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Llumos</CardTitle>
          <CardDescription>
            Let's set up your organization to start optimizing your AI search visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                value={formData.orgName}
                onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={formData.domain}
                onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., SaaS, E-commerce, Healthcare"
                value={formData.industry}
                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Target Keywords</Label>
              <Textarea
                id="keywords"
                placeholder="e.g., project management, task tracking, productivity"
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitors">Competitors (Optional)</Label>
              <Textarea
                id="competitors"
                placeholder="e.g., Notion, Asana, Monday.com"
                value={formData.competitors}
                onChange={(e) => setFormData(prev => ({ ...prev, competitors: e.target.value }))}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}