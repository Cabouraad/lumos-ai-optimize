/**
 * Labs Page - Admin-only feature toggles and experimental features
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Beaker, Settings, Users, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LabsFeature {
  id: string;
  name: string;
  description: string;
  status: 'experimental' | 'beta' | 'stable';
  enabled: boolean;
  adminOnly: boolean;
  risks: string[];
}

export default function Labs() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<LabsFeature[]>([]);
  const [orgData, setOrgData] = useState<{ id: string; name: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    loadLabsFeatures();
    loadOrgData();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role, org_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(userData.role === 'owner');
    } catch (error) {
      console.error('Error checking admin access:', error);
    }
  };

  const loadOrgData = async () => {
    if (!user) return;
    
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userData?.org_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', userData.org_id)
          .single();
          
        setOrgData(org);
      }
    } catch (error) {
      console.error('Error loading org data:', error);
    }
  };

  const loadLabsFeatures = async () => {
    setLoading(true);
    try {
      // Load feature flags from database and local config
      const labsFeatures: LabsFeature[] = [
        {
          id: 'ANALYZER_V2',
          name: 'Enhanced Brand Analyzer (V2)',
          description: 'Advanced 4-stage brand detection pipeline with improved accuracy and per-org isolation. Reduces false positives like generic verbs.',
          status: 'beta',
          enabled: false, // Will be loaded from database
          adminOnly: true,
          risks: [
            'May produce different competitor lists than V1',
            'Performance impact during initial rollout',
            'Requires careful testing with org-specific data'
          ]
        },
        {
          id: 'BULK_QUERIES',
          name: 'Bulk Query Optimization',
          description: 'Batch database queries to reduce N+1 problems and improve dashboard performance.',
          status: 'experimental',
          enabled: false,
          adminOnly: true,
          risks: [
            'May cause temporary performance degradation',
            'Complex query patterns need validation'
          ]
        },
        {
          id: 'RESPONSE_CACHE',
          name: 'Response Caching',
          description: 'Cache AI provider responses to improve performance and reduce API costs.',
          status: 'experimental', 
          enabled: false,
          adminOnly: true,
          risks: [
            'Cache invalidation complexity',
            'Storage overhead'
          ]
        }
      ];

      // Load actual feature states from database
      const { data: orgFlags } = await supabase
        .from('feature_flags')
        .select('flag_name, enabled')
        .in('flag_name', labsFeatures.map(f => `FEATURE_${f.id}`));

      // Update enabled states
      if (orgFlags) {
        labsFeatures.forEach(feature => {
          const dbFlag = orgFlags.find(f => f.flag_name === `FEATURE_${feature.id}`);
          if (dbFlag) {
            feature.enabled = dbFlag.enabled;
          }
        });
      }

      setFeatures(labsFeatures);
    } catch (error) {
      console.error('Error loading labs features:', error);
      toast.error('Failed to load labs features');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureId: string, enabled: boolean) => {
    if (!isAdmin || !orgData) {
      toast.error('Admin access required');
      return;
    }

    try {
      const flagName = `FEATURE_${featureId}`;
      
      // Upsert feature flag in database
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          flag_name: flagName,
          enabled: enabled,
          description: features.find(f => f.id === featureId)?.description || ''
        }, {
          onConflict: 'flag_name'
        });

      if (error) throw error;

      // Update local state
      setFeatures(prev => prev.map(f => 
        f.id === featureId ? { ...f, enabled } : f
      ));

      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'} successfully`);
      
      // Special handling for V2 analyzer
      if (featureId === 'ANALYZER_V2' && enabled) {
        toast.info('V2 Analyzer enabled. New analyses will use enhanced pipeline.', {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Failed to update feature flag');
    }
  };

  const testBatchProcessor = async () => {
    if (!orgData?.id) {
      toast.error('Organization data not loaded');
      return;
    }

    setIsTesting(true);
    try {
      toast.info('Starting batch processor test...');
      
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: { 
          orgId: orgData.id,
          replace: true 
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Batch job created! Job ID: ${data.jobId}`, {
          description: `Total tasks: ${data.total_tasks}`,
          duration: 5000
        });
      } else {
        toast.error(`Batch processor error: ${data?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Batch processor test failed:', error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusColor = (status: LabsFeature['status']) => {
    switch (status) {
      case 'experimental': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'beta': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stable': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access Labs features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            Labs access is restricted to organization owners only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Beaker className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Labs</h1>
          <p className="text-muted-foreground">
            Experimental features and advanced settings for {orgData?.name || 'your organization'}
          </p>
        </div>
      </div>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Caution:</strong> Labs features are experimental and may affect your organization's data analysis. 
          Test thoroughly before enabling in production environments.
        </AlertDescription>
      </Alert>

      {/* Batch Processor Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Batch Processor Test
          </CardTitle>
          <CardDescription>
            Test the batch processor with your organization's prompts. This will trigger a full batch run using all enabled providers (OpenAI, Perplexity, Gemini, and Google AI Overviews for Pro+ subscriptions).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={testBatchProcessor} 
            disabled={isTesting || !orgData}
            className="w-full sm:w-auto"
          >
            {isTesting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Running Test...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Batch Processor Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {features.map((feature) => (
            <Card key={feature.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {feature.name}
                    </CardTitle>
                    <Badge className={getStatusColor(feature.status)}>
                      {feature.status}
                    </Badge>
                  </div>
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={(enabled) => toggleFeature(feature.id, enabled)}
                    disabled={loading}
                  />
                </div>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {feature.risks.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        Risks & Considerations:
                      </Label>
                      <ul className="mt-1 text-sm text-muted-foreground space-y-1">
                        {feature.risks.map((risk, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Status:</span>
                      <Badge variant={feature.enabled ? "default" : "secondary"}>
                        {feature.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    {feature.id === 'ANALYZER_V2' && feature.enabled && (
                      <Button variant="outline" size="sm">
                        Run Backfill
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}