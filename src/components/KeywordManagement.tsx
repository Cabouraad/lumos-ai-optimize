import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
import { getBrandBusinessContext, updateBrandBusinessContext, type BrandBusinessContext } from "@/lib/brand/data";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function KeywordManagement() {
  const [keywords, setKeywords] = useState<BrandBusinessContext>({
    keywords: [],
    products_services: "",
    target_audience: "",
    business_description: "",
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const { toast } = useToast();
  const { loading: authLoading, user } = useAuth();
  const { selectedBrand, isValidated: brandValidated } = useBrand();

  useEffect(() => {
    if (authLoading || !brandValidated) return;
    if (!user || !selectedBrand?.id) {
      setLoading(false);
      return;
    }
    loadKeywords();
  }, [authLoading, brandValidated, user, selectedBrand?.id]);

  const loadKeywords = async () => {
    if (!selectedBrand?.id) return;
    
    try {
      setLoading(true);
      const data = await getBrandBusinessContext(selectedBrand.id);
      setKeywords(data);
    } catch (error) {
      console.error('Failed to load brand business context:', error);
      toast({
        title: "Error",
        description: "Failed to load business context",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBrand?.id) {
      toast({
        title: "No brand selected",
        description: "Please select a brand to save business context",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await updateBrandBusinessContext(selectedBrand.id, {
        keywords: keywords.keywords,
        products_services: keywords.products_services,
        target_audience: keywords.target_audience,
        business_description: keywords.business_description,
      });
      toast({
        title: "Success",
        description: `Business context updated for ${selectedBrand.name}`,
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addKeyword();
    }
  };

  const handleAutoFill = async () => {
    if (!selectedBrand?.id) {
      toast({
        title: "No brand selected",
        description: "Please select a brand first",
        variant: "destructive",
      });
      return;
    }

    try {
      setAutoFilling(true);
      
      const session = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('auto-fill-business-context', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: { brandId: selectedBrand.id }
      });

      if (error) throw error;

      if (data.success) {
        setKeywords(prev => ({
          ...prev,
          keywords: [...new Set([...prev.keywords, ...data.data.keywords])],
          business_description: data.data.business_description || prev.business_description,
          products_services: data.data.products_services || prev.products_services,
          target_audience: data.data.target_audience || prev.target_audience,
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
      } else {
        throw new Error(data.error || 'Failed to auto-fill');
      }
    } catch (error: unknown) {
      console.error('Auto-fill error:', error);
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to auto-fill business context",
        variant: "destructive",
      });
    } finally {
      setAutoFilling(false);
    }
  };

  if (!brandValidated) {
    return <div className="animate-pulse">Loading brand context...</div>;
  }

  if (!selectedBrand) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select a brand to manage its business context.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div className="animate-pulse">Loading business context...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Business Context for {selectedBrand.name}
        </CardTitle>
        <CardDescription>
          Add keywords and context about this brand to generate more relevant AI prompt suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-fill section */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Auto-fill from Website</h4>
              <p className="text-xs text-muted-foreground">
                Automatically extract business context from {selectedBrand.domain}
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

        <div>
          <Label htmlFor="business-description">Business Description</Label>
          <Textarea
            id="business-description"
            placeholder="Brief description of what this brand does..."
            value={keywords.business_description}
            onChange={(e) => setKeywords(prev => ({ ...prev, business_description: e.target.value }))}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="products-services">Main Products & Services</Label>
          <Textarea
            id="products-services"
            placeholder="Describe the main products and services for this brand..."
            value={keywords.products_services}
            onChange={(e) => setKeywords(prev => ({ ...prev, products_services: e.target.value }))}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="target-audience">Target Audience</Label>
          <Textarea
            id="target-audience"
            placeholder="Describe the ideal customers and target market for this brand..."
            value={keywords.target_audience}
            onChange={(e) => setKeywords(prev => ({ ...prev, target_audience: e.target.value }))}
            rows={3}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : `Save Business Context for ${selectedBrand.name}`}
        </Button>
      </CardContent>
    </Card>
  );
}
