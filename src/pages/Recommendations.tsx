import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, X, FileText, Share, Globe, Lightbulb } from 'lucide-react';

export default function Recommendations() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadRecommendations();
    }
  }, [orgData]);

  const loadRecommendations = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      const { data } = await supabase
        .from('recommendations')
        .select(`
          *,
          prompts (text)
        `)
        .eq('org_id', orgData.organizations.id)
        .neq('title', 'DOMAIN_TOKEN') // Exclude internal tokens
        .order('created_at', { ascending: false });

      setRecommendations(data || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'done' | 'ignored') => {
    try {
      const { error } = await supabase
        .from('recommendations')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Recommendation marked as ${status}`,
      });

      loadRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'content': return <FileText className="h-4 w-4" />;
      case 'social': return <Share className="h-4 w-4" />;
      case 'site': return <Globe className="h-4 w-4" />;
      case 'knowledge': return <Lightbulb className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'content': return 'bg-blue-100 text-blue-800';
      case 'social': return 'bg-green-100 text-green-800';
      case 'site': return 'bg-purple-100 text-purple-800';
      case 'knowledge': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedRecommendations = recommendations.reduce((groups, rec) => {
    const type = rec.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(rec);
    return groups;
  }, {} as Record<string, any[]>);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recommendations</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions to improve your search visibility
          </p>
        </div>

        {Object.keys(groupedRecommendations).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedRecommendations).map(([type, recs]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {getTypeIcon(type)}
                    <span className="capitalize">{type} Recommendations</span>
                    <Badge variant="secondary">{(recs as any[]).filter(r => r.status === 'open').length} open</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(recs as any[]).map((rec) => (
                      <div key={rec.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium">{rec.title}</h4>
                              <Badge 
                                variant="outline" 
                                className={getTypeColor(rec.type)}
                              >
                                {rec.type}
                              </Badge>
                              {rec.status !== 'open' && (
                                <Badge variant={rec.status === 'done' ? 'default' : 'secondary'}>
                                  {rec.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {rec.rationale}
                            </p>
                            {rec.prompts && (
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                Related prompt: "{rec.prompts.text?.slice(0, 100)}..."
                              </div>
                            )}
                          </div>
                          
                          {rec.status === 'open' && (
                            <div className="flex space-x-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(rec.id, 'done')}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Done
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(rec.id, 'ignored')}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Ignore
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Run some prompts to get personalized suggestions</p>
                <p>• Enable weekly suggestion generation</p>
                <p>• Monitor your brand visibility consistently</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}