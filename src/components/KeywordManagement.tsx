import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationKeywords, updateOrganizationKeywords, type OrganizationKeywords } from "@/lib/org/data";

export function KeywordManagement() {
  const [keywords, setKeywords] = useState<OrganizationKeywords>({
    keywords: [],
    products_services: "",
    target_audience: "",
    business_description: "",
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      const data = await getOrganizationKeywords();
      setKeywords(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load keywords",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateOrganizationKeywords(keywords);
      toast({
        title: "Success",
        description: "Keywords and business context updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save keywords",
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

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Business Context"}
        </Button>
      </CardContent>
    </Card>
  );
}