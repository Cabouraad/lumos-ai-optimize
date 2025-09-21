import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Sparkles, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getOrganizationKeywords, updateOrganizationKeywords, type OrganizationKeywords } from "@/lib/org/data";
import { supabase } from "@/integrations/supabase/client";

export function KeywordManagement() {
  const [keywords, setKeywords] = useState<OrganizationKeywords>({
    keywords: [],
    competitors: [],
    products_services: "",
    target_audience: "",
    business_description: "",
    business_city: "",
    business_state: "",
    business_country: "United States",
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const { toast } = useToast();
  const { loading: authLoading, user, orgData } = useAuth();

  useEffect(() => {
    // Wait for auth to be ready and org data to be available
    if (authLoading) return;
    if (!user || !orgData?.organizations?.id) return;
    loadKeywords();
  }, [authLoading, user, orgData?.organizations?.id]);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      const data = await getOrganizationKeywords();
      setKeywords(data);
    } catch (error) {
      console.error('Failed to load keywords:', error);
      
      // Only show toast for real errors, not auth-not-ready states
      if (!authLoading && user && orgData?.organizations?.id) {
        toast({
          title: "Error",
          description: "Failed to load keywords",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Only update business context fields, not localization settings
      const businessContextUpdate = {
        keywords: keywords.keywords,
        competitors: keywords.competitors,
        products_services: keywords.products_services,
        target_audience: keywords.target_audience,
        business_description: keywords.business_description,
        business_city: keywords.business_city,
        business_state: keywords.business_state,
        business_country: keywords.business_country,
      };
      
      await updateOrganizationKeywords(businessContextUpdate);
      toast({
        title: "Success",
        description: "Business context updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save business context",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.keywords.includes(newKeyword.trim())) {
      setKeywords(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const addCompetitor = () => {
    if (newCompetitor.trim() && !keywords.competitors?.includes(newCompetitor.trim())) {
      setKeywords(prev => ({
        ...prev,
        competitors: [...(prev.competitors || []), newCompetitor.trim()]
      }));
      setNewCompetitor("");
    }
  };

  const removeCompetitor = (competitor: string) => {
    setKeywords(prev => ({
      ...prev,
      competitors: prev.competitors?.filter(c => c !== competitor) || []
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addKeyword();
    }
  };

  const handleCompetitorKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addCompetitor();
    }
  };

  const handleAutoFill = async () => {
    console.log('=== STARTING AUTO-FILL ===');
    try {
      setAutoFilling(true);
      
      const session = await supabase.auth.getSession();
      console.log('Auth session:', session.data.session ? 'Present' : 'Missing');
      
      console.log('Calling auto-fill function...');
      const { data, error } = await supabase.functions.invoke('auto-fill-business-context', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      console.log('Function response:', { data, error });

      if (error) throw error;

      if (data.success) {
        // Update the local state with auto-filled data
        setKeywords(prev => ({
          ...prev,
          keywords: [...new Set([...prev.keywords, ...data.data.keywords])], // Merge without duplicates
          competitors: [...new Set([...(prev.competitors || []), ...(data.data.competitors || [])])], // Merge without duplicates
          business_description: data.data.business_description || prev.business_description,
          products_services: data.data.products_services || prev.products_services,
          target_audience: data.data.target_audience || prev.target_audience,
          business_city: data.data.business_city || prev.business_city,
          business_state: data.data.business_state || prev.business_state,
          business_country: data.data.business_country || prev.business_country,
        }));
        
        toast({
          title: "Success",
          description: data.message || "Business context auto-filled from your website!",
        });
      } else if (data.needsApiKey) {
        toast({
          title: "OpenAI API Key Required",
          description: "Please add your OpenAI API key in the project settings to use the auto-fill feature.",
          variant: "destructive",
        });
      } else if (data.suggestManual) {
        toast({
          title: "Auto-fill Failed",
          description: data.error || "Unable to fetch website content. Please fill in the information manually.",
          variant: "destructive",
        });
      } else {
        throw new Error(data.error || 'Failed to auto-fill');
      }
    } catch (error) {
      console.error('Auto-fill error:', error);
      toast({
        title: "Error", 
        description: error.message || "Failed to auto-fill business context. Please try again or fill in manually.",
        variant: "destructive",
      });
    } finally {
      setAutoFilling(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading keyword management...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Business Context & Keywords
        </CardTitle>
        <CardDescription>
          Add keywords and context about your business to generate more relevant AI prompt suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-fill section */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Auto-fill from Website</h4>
              <p className="text-xs text-muted-foreground">
                Automatically extract business context from your website
              </p>
            </div>
            <Button
              onClick={handleAutoFill}
              disabled={autoFilling}
              variant="outline"
              size="sm"
              className="bg-background hover:bg-primary/5"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {autoFilling ? "Analyzing..." : "Auto-fill"}
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="keywords">Industry & Product Keywords</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="keywords"
              placeholder="Add keyword (e.g., legal, CRM, consulting)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button onClick={addKeyword} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Always show keywords section */}
          <div className="mt-3">
            <div className="text-sm font-medium text-foreground mb-2">
              Saved Keywords ({keywords.keywords.length}):
            </div>
            {keywords.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                {keywords.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                    {keyword}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                      onClick={() => removeKeyword(keyword)}
                    />
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                <p className="text-sm text-muted-foreground text-center">
                  No keywords saved yet. Add keywords above to improve your AI prompt suggestions.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Competitors Section */}
        <div>
          <Label htmlFor="competitors">Competitors Database</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="competitors"
              placeholder="Add competitor (e.g., Salesforce, Monday.com)"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              onKeyPress={handleCompetitorKeyPress}
            />
            <Button onClick={addCompetitor} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3">
            <div className="text-sm font-medium text-foreground mb-2">
              Saved Competitors ({keywords.competitors?.length || 0}):
            </div>
            {keywords.competitors && keywords.competitors.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                {keywords.competitors.map((competitor, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                    {competitor}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                      onClick={() => removeCompetitor(competitor)}
                    />
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                <p className="text-sm text-muted-foreground text-center">
                  No competitors saved yet. Only competitors from this list will appear on prompt cards.
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="business-description">Business Description</Label>
          <Textarea
            id="business-description"
            placeholder="Brief description of what your business does..."
            value={keywords.business_description}
            onChange={(e) => setKeywords(prev => ({ ...prev, business_description: e.target.value }))}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="products-services">Main Products & Services</Label>
          <Textarea
            id="products-services"
            placeholder="Describe your main products and services..."
            value={keywords.products_services}
            onChange={(e) => setKeywords(prev => ({ ...prev, products_services: e.target.value }))}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="target-audience">Target Audience</Label>
          <Textarea
            id="target-audience"
            placeholder="Describe your ideal customers and target market..."
            value={keywords.target_audience}
            onChange={(e) => setKeywords(prev => ({ ...prev, target_audience: e.target.value }))}
            rows={3}
          />
        </div>

        {/* Business Location Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Business Location</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="business-city">City</Label>
              <Input
                id="business-city"
                placeholder="e.g., New York"
                value={keywords.business_city}
                onChange={(e) => setKeywords(prev => ({ ...prev, business_city: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="business-state">State/Province</Label>
              <Input
                id="business-state"
                placeholder="e.g., Pennsylvania"
                value={keywords.business_state}
                onChange={(e) => setKeywords(prev => ({ ...prev, business_state: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="business-country">Country</Label>
              <Input
                id="business-country"
                placeholder="e.g., United States"
                value={keywords.business_country}
                onChange={(e) => setKeywords(prev => ({ ...prev, business_country: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Business Context"}
        </Button>
      </CardContent>
    </Card>
  );
}