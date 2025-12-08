import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Copy, 
  Check, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Code2,
  FileText,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import type { EditorState } from '../hooks/useContentEditor';
import type { ContentStudioItem } from '../types';

interface SEOMetadataProps {
  editorState: EditorState;
  item: ContentStudioItem;
}

interface SEOData {
  titleTag: string;
  metaDescription: string;
  keywords: string[];
  schemaMarkup: string;
}

export function SEOMetadataPanel({ editorState, item }: SEOMetadataProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seoData, setSeoData] = useState<SEOData>({
    titleTag: '',
    metaDescription: '',
    keywords: [],
    schemaMarkup: '',
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-generate basic SEO data from content
  useEffect(() => {
    if (!editorState.title) return;

    // Generate title tag (max 60 chars)
    const titleTag = editorState.title.length > 57 
      ? editorState.title.substring(0, 57) + '...'
      : editorState.title;

    // Generate meta description from first section content (max 160 chars)
    const firstContent = editorState.sections[0]?.content || '';
    const metaDescription = firstContent.length > 157
      ? firstContent.substring(0, 157) + '...'
      : firstContent || `Learn about ${editorState.title}. Comprehensive guide with expert insights.`;

    // Use key entities as keywords
    const keywords = item.key_entities.slice(0, 10);

    // Generate schema markup based on content type
    const schemaMarkup = generateSchemaMarkup(item, editorState);

    setSeoData({
      titleTag,
      metaDescription: metaDescription.substring(0, 160),
      keywords,
      schemaMarkup,
    });
  }, [editorState, item]);

  const handleCopy = async (field: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI generation - in production, call edge function
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Enhanced generation based on content
      const enhancedTitle = `${editorState.title} | Expert Guide ${new Date().getFullYear()}`;
      const enhancedDesc = `Discover ${item.key_entities.slice(0, 3).join(', ')} in this comprehensive guide. ${editorState.title.substring(0, 80)}`;
      
      setSeoData(prev => ({
        ...prev,
        titleTag: enhancedTitle.substring(0, 60),
        metaDescription: enhancedDesc.substring(0, 160),
      }));
      
      toast.success('SEO metadata enhanced with AI');
    } catch (error) {
      toast.error('Failed to generate SEO metadata');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                SEO Metadata
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* AI Enhance Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="w-full gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
              Enhance with AI
            </Button>

            {/* Title Tag */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Title Tag
                  <Badge variant="outline" className="text-xs ml-1">
                    {seoData.titleTag.length}/60
                  </Badge>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('title', seoData.titleTag)}
                  className="h-6 px-2"
                >
                  {copiedField === 'title' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Input
                value={seoData.titleTag}
                onChange={(e) => setSeoData(prev => ({ 
                  ...prev, 
                  titleTag: e.target.value.substring(0, 60) 
                }))}
                className="text-sm"
                placeholder="SEO-optimized title..."
              />
            </div>

            {/* Meta Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Meta Description
                  <Badge variant="outline" className="text-xs ml-1">
                    {seoData.metaDescription.length}/160
                  </Badge>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('desc', seoData.metaDescription)}
                  className="h-6 px-2"
                >
                  {copiedField === 'desc' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Textarea
                value={seoData.metaDescription}
                onChange={(e) => setSeoData(prev => ({ 
                  ...prev, 
                  metaDescription: e.target.value.substring(0, 160) 
                }))}
                className="text-sm min-h-[60px] resize-none"
                placeholder="SEO meta description..."
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Focus Keywords
              </label>
              <div className="flex flex-wrap gap-1">
                {seoData.keywords.map((keyword, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Schema Markup */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Code2 className="h-3 w-3" />
                  JSON-LD Schema
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('schema', seoData.schemaMarkup)}
                  className="h-6 px-2"
                >
                  {copiedField === 'schema' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {seoData.schemaMarkup || 'No schema generated yet. Add content to generate schema markup.'}
                </pre>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function generateSchemaMarkup(item: ContentStudioItem, editorState: EditorState): string {
  const baseSchema: any = {
    '@context': 'https://schema.org',
  };

  // Generate schema based on content type and suggestions
  if (item.content_type === 'faq_page' || item.schema_suggestions.some(s => s.type === 'FAQPage')) {
    const faqSchema = {
      ...baseSchema,
      '@type': 'FAQPage',
      mainEntity: editorState.faqs
        .filter(f => f.answer)
        .map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
    };
    return JSON.stringify(faqSchema, null, 2);
  }

  if (item.content_type === 'blog_post' || item.schema_suggestions.some(s => s.type === 'Article')) {
    const articleSchema = {
      ...baseSchema,
      '@type': 'Article',
      headline: editorState.title,
      description: editorState.sections[0]?.content?.substring(0, 160) || '',
      keywords: item.key_entities.join(', '),
      articleBody: editorState.sections.map(s => s.content).join(' ').substring(0, 500),
    };
    return JSON.stringify(articleSchema, null, 2);
  }

  if (item.schema_suggestions.some(s => s.type === 'HowTo')) {
    const howToSchema = {
      ...baseSchema,
      '@type': 'HowTo',
      name: editorState.title,
      step: editorState.sections.map((section, idx) => ({
        '@type': 'HowToStep',
        position: idx + 1,
        name: section.heading,
        text: section.content || section.suggestions.join('. '),
      })),
    };
    return JSON.stringify(howToSchema, null, 2);
  }

  // Default Article schema
  const defaultSchema = {
    ...baseSchema,
    '@type': 'Article',
    headline: editorState.title,
    keywords: item.key_entities.join(', '),
  };
  return JSON.stringify(defaultSchema, null, 2);
}
