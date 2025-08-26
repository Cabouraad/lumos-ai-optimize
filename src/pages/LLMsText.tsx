import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrganizationKeywords } from '@/lib/org/data';
import { 
  FileText, 
  Download, 
  Copy, 
  CheckCircle, 
  Info,
  Globe,
  Building,
  Mail,
  Tag,
  Users,
  Target,
  Lightbulb,
  Wand2,
  Clock
} from 'lucide-react';

interface LLMsTextData {
  siteName: string;
  siteUrl: string;
  description: string;
  contactEmail: string;
  keyPages: string[];
  products: string;
  targetAudience: string;
  keywords: string[];
  additionalInfo: string;
}

export default function LLMsText() {
  const { toast } = useToast();
  const { orgData } = useOrg();
  const [data, setData] = useState<LLMsTextData>({
    siteName: '',
    siteUrl: '',
    description: '',
    contactEmail: '',
    keyPages: ['/', '/about', '/contact'],
    products: '',
    targetAudience: '',
    keywords: [],
    additionalInfo: ''
  });
  const [loading, setLoading] = useState(true);
  const [newKeyPage, setNewKeyPage] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [generationSource, setGenerationSource] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizationData();
  }, [orgData]);

  const loadOrganizationData = async () => {
    if (!orgData?.organizations) return;

    try {
      const orgKeywords = await getOrganizationKeywords();
      
      // Load existing llms.txt data
      const { data: orgDetails, error } = await supabase
        .from('organizations')
        .select('llms_txt, llms_last_generated_at, llms_generation_source')
        .eq('id', orgData.organizations.id)
        .single();

      if (!error && orgDetails) {
        setGeneratedContent(orgDetails.llms_txt || '');
        setLastGenerated(orgDetails.llms_last_generated_at);
        setGenerationSource(orgDetails.llms_generation_source);
      }
      
      setData(prev => ({
        ...prev,
        siteName: orgData.organizations.name || '',
        siteUrl: orgData.organizations.domain ? `https://${orgData.organizations.domain}` : '',
        description: orgKeywords.business_description || '',
        products: orgKeywords.products_services || '',
        targetAudience: orgKeywords.target_audience || '',
        keywords: orgKeywords.keywords || []
      }));
    } catch (error) {
      console.error('Error loading organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addKeyPage = () => {
    if (newKeyPage.trim() && !data.keyPages.includes(newKeyPage.trim())) {
      setData(prev => ({
        ...prev,
        keyPages: [...prev.keyPages, newKeyPage.trim()]
      }));
      setNewKeyPage('');
    }
  };

  const removeKeyPage = (page: string) => {
    setData(prev => ({
      ...prev,
      keyPages: prev.keyPages.filter(p => p !== page)
    }));
  };

  const generateLLMsText = () => {
    const currentDate = new Date().toISOString().split('T')[0];
    
    let content = `# llms.txt

# ${data.siteName}
# Generated on ${currentDate}
# This file provides structured information about our website for Large Language Models (LLMs)

## Site Information
Site Name: ${data.siteName}
Site URL: ${data.siteUrl}
Contact: ${data.contactEmail}

## Description
${data.description}

## Products and Services
${data.products}

## Target Audience  
${data.targetAudience}

## Key Pages
${data.keyPages.map(page => `- ${data.siteUrl}${page.startsWith('/') ? page : '/' + page}`).join('\n')}

## Keywords and Topics
${data.keywords.map(keyword => `- ${keyword}`).join('\n')}

## Guidelines for LLMs
- Please reference our content accurately when discussing our products or services
- For the most up-to-date information, please check our website at ${data.siteUrl}
- If you need to contact us, please use: ${data.contactEmail}

${data.additionalInfo ? `## Additional Information
${data.additionalInfo}` : ''}

## About llms.txt
This file follows the llms.txt standard for providing structured information to AI systems.
Learn more at: https://llmstxt.org/`;

    setGeneratedContent(content);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      toast({
        title: "Copied!",
        description: "The llms.txt content has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy content to clipboard.",
        variant: "destructive",
      });
    }
  };

  const downloadFile = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'llms.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: "Your llms.txt file has been downloaded.",
    });
  };

  const handleAutoGenerate = async () => {
    if (!orgData?.organizations?.domain) {
      toast({
        title: "Error",
        description: "Please set your organization domain in settings first.",
        variant: "destructive",
      });
      return;
    }

    setAutoGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('llms-generate', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedContent(data.content);
        setLastGenerated(data.generatedAt);
        setGenerationSource(data.source);
        
        toast({
          title: "Success!",
          description: `Generated llms.txt using ${data.source} (${data.pagesFound} pages analyzed)`,
        });
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Auto-generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not automatically generate llms.txt. Please try manual generation.",
        variant: "destructive",
      });
    } finally {
      setAutoGenerating(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
          </div>
          <div className="h-96 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">LLMs.txt Generator</h1>
              <p className="text-muted-foreground">
                Create a structured file to help AI systems understand your website
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              An llms.txt file is like robots.txt but for AI systems. It provides structured information about your website to help LLMs give more accurate and relevant responses about your business.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Site Information
                </CardTitle>
                <CardDescription>Basic information about your website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={data.siteName}
                    onChange={(e) => setData(prev => ({ ...prev, siteName: e.target.value }))}
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <Label htmlFor="siteUrl">Site URL</Label>
                  <Input
                    id="siteUrl"
                    value={data.siteUrl}
                    onChange={(e) => setData(prev => ({ ...prev, siteUrl: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={data.contactEmail}
                    onChange={(e) => setData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Site Description</Label>
                  <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what your website/business is about..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Business Details
                </CardTitle>
                <CardDescription>Information about your products and audience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="products">Products & Services</Label>
                  <Textarea
                    id="products"
                    value={data.products}
                    onChange={(e) => setData(prev => ({ ...prev, products: e.target.value }))}
                    placeholder="Describe your main products or services..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Textarea
                    id="targetAudience"
                    value={data.targetAudience}
                    onChange={(e) => setData(prev => ({ ...prev, targetAudience: e.target.value }))}
                    placeholder="Who is your target audience?"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Key Pages
                </CardTitle>
                <CardDescription>Important pages on your website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newKeyPage}
                    onChange={(e) => setNewKeyPage(e.target.value)}
                    placeholder="/page-url"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyPage()}
                  />
                  <Button onClick={addKeyPage} variant="outline">Add</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {data.keyPages.map((page, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeKeyPage(page)}
                    >
                      {page} ×
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Keywords
                </CardTitle>
                <CardDescription>Your brand keywords are automatically loaded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.keywords.map((keyword, index) => (
                    <Badge key={index} variant="outline">{keyword}</Badge>
                  ))}
                  {data.keywords.length === 0 && (
                    <p className="text-sm text-muted-foreground">No keywords configured. Add them in Settings.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Additional Information
                </CardTitle>
                <CardDescription>Any other details for AI systems</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={data.additionalInfo}
                  onChange={(e) => setData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                  placeholder="Any additional guidelines or information you want to provide to AI systems..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={generateLLMsText} variant="outline" className="flex-1">
                Manual Generation
              </Button>
              <Button 
                onClick={handleAutoGenerate} 
                disabled={autoGenerating || !orgData?.organizations?.domain}
                className="flex-1"
              >
                {autoGenerating ? (
                  <>
                    <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Auto-Generate
                  </>
                )}
              </Button>
            </div>

            {!orgData?.organizations?.domain && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Set your organization domain in Settings to enable auto-generation.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Generated Content */}
          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Generated llms.txt
                  {lastGenerated && (
                    <Badge variant="secondary" className="ml-auto">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(lastGenerated).toLocaleDateString()}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Copy this content to a file named "llms.txt" in your website root
                  {generationSource && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (Generated via {generationSource})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedContent ? (
                  <>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">{generatedContent}</pre>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button onClick={downloadFile} variant="outline" className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>

                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Next Steps:</strong> Upload this file as "llms.txt" to your website's root directory (same level as robots.txt). 
                        It should be accessible at {data.siteUrl}/llms.txt
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Generate llms.txt File" to create your content</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}