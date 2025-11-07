import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Info, ArrowLeft } from 'lucide-react';
import { OnboardingPromptSelection } from '@/components/onboarding/OnboardingPromptSelection';
import { acceptMultipleSuggestions } from '@/lib/suggestions/data';

export default function BrandOnboarding() {
  const { user, orgData } = useAuth();
  const { setSelectedBrand } = useBrand();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic info, 2: Business Context, 3: Prompts
  const [promptSuggestionsGenerated, setPromptSuggestionsGenerated] = useState(false);
  const [showManualFillBanner, setShowManualFillBanner] = useState(false);
  const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);
  
  const businessContextRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    brandName: '',
    domain: '',
    keywords: '',
    competitors: '',
    business_description: '',
    products_services: '',
    target_audience: ''
  });

  // Redirect if not Pro user or no org
  if (!orgData?.org_id) {
    navigate('/brands');
    return null;
  }

  const handleCreateBrand = async () => {
    // Validate required fields
    if (!formData.brandName || !formData.domain) {
      toast({
        title: "Missing Information",
        description: "Please provide both brand name and domain.",
        variant: "destructive"
      });
      return;
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    const cleanedDomain = formData.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    
    if (!domainRegex.test(cleanedDomain)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain format (e.g., example.com)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create the brand
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .insert([
          {
            org_id: orgData.org_id,
            name: formData.brandName,
            domain: cleanedDomain,
            is_primary: false
          }
        ])
        .select()
        .single();

      if (brandError) throw brandError;

      setCreatedBrandId(brandData.id);

      toast({
        title: "Brand Created!",
        description: "Now let's set up the business context for this brand.",
      });

      // Move to next step
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Brand creation error:", error);
      
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Brand Already Exists",
          description: "A brand with this domain already exists in your organization.",
          variant: "destructive",
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to create brand',
          variant: 'destructive',
        });
      }
    }

    setLoading(false);
  };

  const handleUpdateBrandContext = async () => {
    if (!createdBrandId) return;

    setLoading(true);

    try {
      // Update organization with brand-specific context
      const { error } = await supabase
        .from('organizations')
        .update({
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          competitors: formData.competitors.split(',').map(c => c.trim()).filter(Boolean),
          business_description: formData.business_description,
          products_services: formData.products_services,
          target_audience: formData.target_audience
        })
        .eq('id', orgData.org_id);

      if (error) throw error;

      toast({
        title: "Business Context Saved!",
        description: "Let's generate some AI prompt suggestions for this brand.",
      });

      setCurrentStep(3);
    } catch (error: any) {
      console.error("Context update error:", error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save business context',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleGeneratePromptSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-prompts-now', {
        body: {
          brandId: createdBrandId
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "AI Suggestions Generated!",
        description: `Generated ${data?.suggestionsCreated || 0} prompt suggestions for your brand.`,
      });
      
      setPromptSuggestionsGenerated(true);
    } catch (error: any) {
      console.error("Prompt suggestions error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate suggestions",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handlePromptSelectionComplete = async (
    selectedSuggestionIds: string[],
    manualPrompts: string[]
  ) => {
    setLoading(true);
    try {
      const result = await acceptMultipleSuggestions(selectedSuggestionIds, manualPrompts);
      
      toast({
        title: "Prompts Activated!",
        description: `${result.promptsCreated} prompt${result.promptsCreated !== 1 ? 's' : ''} are now being tracked for this brand`,
      });

      // Set the newly created brand as selected and navigate to dashboard
      if (createdBrandId) {
        const { data: brand } = await supabase
          .from('brands')
          .select('*')
          .eq('id', createdBrandId)
          .single();
        
        if (brand) {
          setSelectedBrand(brand);
        }
      }
      
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Prompt acceptance error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to activate prompts",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleAutoFill = async () => {
    if (!formData.domain) {
      toast({
        title: "Domain Required",
        description: "Please enter your domain first to auto-fill business context.",
        variant: "destructive",
      });
      return;
    }

    setAutoFillLoading(true);
    setShowManualFillBanner(false);
    
    try {
      const session = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('auto-fill-business-context', {
        body: {
          domain: formData.domain
        },
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success && data?.businessContext) {
        const context = data.businessContext;
        
        setFormData(prev => ({
          ...prev,
          keywords: context.keywords ? context.keywords.join(', ') : prev.keywords,
          competitors: context.competitors ? context.competitors.join(', ') : prev.competitors,
          business_description: context.business_description || prev.business_description,
          products_services: context.products_services || prev.products_services,
          target_audience: context.target_audience || prev.target_audience,
        }));

        toast({
          title: "Auto-fill Complete!",
          description: "Business context has been populated from your website.",
        });
      } else if (data?.manualFill || data?.suggestManual) {
        setShowManualFillBanner(true);
        
        setTimeout(() => {
          businessContextRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 300);
      }
    } catch (error: any) {
      console.error("Auto-fill error:", error);
      toast({
        title: "Auto-fill Failed",
        description: error.message || "Failed to auto-fill business context",
        variant: "destructive",
      });
    }
    setAutoFillLoading(false);
  };

  const handleSkipPrompts = () => {
    toast({
      title: "Brand Created!",
      description: "You can add prompts later from the dashboard.",
    });
    
    if (createdBrandId) {
      supabase
        .from('brands')
        .select('*')
        .eq('id', createdBrandId)
        .single()
        .then(({ data: brand }) => {
          if (brand) {
            setSelectedBrand(brand);
          }
          navigate('/dashboard');
        });
    } else {
      navigate('/brands');
    }
  };

  // Step 1: Basic Info
  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/brands')}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Brands
              </Button>
            </div>
            <CardTitle>Create New Brand</CardTitle>
            <CardDescription>
              Let's set up a new brand to track its AI visibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateBrand(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Brand Name *</Label>
                <Input
                  id="brand-name"
                  placeholder="e.g., Apple"
                  value={formData.brandName}
                  onChange={(e) => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="domain">Domain *</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="e.g., apple.com"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the main domain for this brand
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Brand...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Business Context
  if (currentStep === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Business Context & Keywords</CardTitle>
            <CardDescription>
              Help us understand your brand to generate relevant AI prompt suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Save time with auto-fill</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Let AI analyze your website ({formData.domain}) and automatically fill in your business context.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={autoFillLoading || !formData.domain}
                >
                  {autoFillLoading ? "Auto-filling..." : "Auto-fill"}
                </Button>
              </div>
            </div>
            
            {showManualFillBanner && (
              <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Manual input needed:</strong> We couldn't automatically extract your business context. 
                  Please fill in the fields below manually.
                </AlertDescription>
              </Alert>
            )}
            
            <div ref={businessContextRef}>
              <form onSubmit={async (e) => { 
                e.preventDefault(); 
                await handleUpdateBrandContext();
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keywords">Target Keywords *</Label>
                  <Textarea
                    id="keywords"
                    placeholder="e.g., project management, task tracking, productivity"
                    value={formData.keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_description">Business Description *</Label>
                  <Textarea
                    id="business_description"
                    placeholder="Describe what your brand does..."
                    value={formData.business_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_description: e.target.value }))}
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="products_services">Key Products/Services *</Label>
                  <Textarea
                    id="products_services"
                    placeholder="List your main products or services..."
                    value={formData.products_services}
                    onChange={(e) => setFormData(prev => ({ ...prev, products_services: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_audience">Target Audience *</Label>
                  <Textarea
                    id="target_audience"
                    placeholder="Describe your ideal customers..."
                    value={formData.target_audience}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competitors">Competitors (Optional)</Label>
                  <Input
                    id="competitors"
                    placeholder="e.g., Competitor A, Competitor B"
                    value={formData.competitors}
                    onChange={(e) => setFormData(prev => ({ ...prev, competitors: e.target.value }))}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => navigate('/brands')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Continue to Prompts'}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Generate Prompts
  if (currentStep === 3 && !promptSuggestionsGenerated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Generate Prompt Suggestions</CardTitle>
            <CardDescription>
              We'll use AI to suggest relevant prompts for your brand based on the business context you provided
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleGeneratePromptSuggestions} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Generating...' : 'Generate AI Suggestions'}
            </Button>
            <Button 
              variant="outline"
              onClick={handleSkipPrompts}
              className="w-full"
            >
              Skip & Add Prompts Later
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 4: Select Prompts
  if (promptSuggestionsGenerated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="container mx-auto max-w-4xl py-8">
          <OnboardingPromptSelection
            onContinue={handlePromptSelectionComplete}
            onBack={() => setCurrentStep(3)}
            isSubscribed={true}
          />
        </div>
      </div>
    );
  }

  return null;
}
