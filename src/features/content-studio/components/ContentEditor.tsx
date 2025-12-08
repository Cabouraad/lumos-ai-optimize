import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  FileText,
  Code2,
  Sparkles,
  Loader2,
  MessageSquare,
  Tag,
  Eye,
  Edit3,
  Save,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ContentStudioItem } from '../types';
import { CONTENT_TYPE_LABELS } from '../types';
import { useContentEditor } from '../hooks/useContentEditor';
import { useAutoSave } from '../hooks/useAutoSave';
import { SectionEditor } from './SectionEditor';
import { ContentMetrics } from './ContentMetrics';
import { SEOMetadataPanel } from './SEOMetadataPanel';

interface ContentEditorProps {
  item: ContentStudioItem;
  onBack?: () => void;
}

export function ContentEditor({ item, onBack }: ContentEditorProps) {
  const {
    editorState,
    resetEditor,
    updateSectionContent,
    updateChildContent,
    updateFaqAnswer,
    updateTitle,
    aiAssist,
    exportAsMarkdown,
    downloadContent,
  } = useContentEditor(item);

  const [activeTab, setActiveTab] = useState('edit');
  const [assistingSection, setAssistingSection] = useState<number | null>(null);

  // Auto-save functionality
  const { lastSaved, isSaving, hasUnsavedChanges, saveNow } = useAutoSave(editorState, {
    itemId: item.id,
    debounceMs: 3000,
    onSaveComplete: () => toast.success('Draft saved', { duration: 1500 }),
    onSaveError: (error) => toast.error('Failed to save draft'),
  });

  useEffect(() => {
    resetEditor(item);
  }, [item.id, resetEditor]);

  if (!editorState) return null;

  const handleAiAssist = async (sectionIndex: number) => {
    setAssistingSection(sectionIndex);
    try {
      const section = editorState.sections[sectionIndex];
      const result = await aiAssist.mutateAsync({
        context: item.topic_key,
        sectionHeading: section.heading,
        suggestions: section.suggestions,
        existingContent: section.content,
        toneGuidelines: item.tone_guidelines,
        keyEntities: item.key_entities,
      });
      return result.generatedContent;
    } catch (error) {
      toast.error('Failed to generate content. Please try again.');
      throw error;
    } finally {
      setAssistingSection(null);
    }
  };

  const handleDownload = (format: 'markdown' | 'html') => {
    downloadContent(format);
    toast.success(`Content downloaded as ${format.toUpperCase()}`);
  };

  const previewContent = exportAsMarkdown();
  const wordCount = previewContent.split(/\s+/).filter(Boolean).length;

  // Format last saved time
  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Not saved';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{item.topic_key}</h1>
              <Badge variant="secondary" className="text-xs">
                {CONTENT_TYPE_LABELS[item.content_type]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {wordCount} words • {editorState.sections.length} sections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <CloudOff className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-600">Unsaved changes</span>
              </>
            ) : (
              <>
                <Cloud className="h-3.5 w-3.5 text-green-500" />
                <span>{formatLastSaved(lastSaved)}</span>
              </>
            )}
          </div>

          {hasUnsavedChanges && (
            <Button variant="outline" size="sm" onClick={saveNow} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Save Now
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDownload('markdown')}>
                <FileText className="h-4 w-4 mr-2" />
                Download as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload('html')}>
                <Code2 className="h-4 w-4 mr-2" />
                Download as HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="h-10">
            <TabsTrigger value="edit" className="gap-1.5">
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Edit Tab */}
          <TabsContent value="edit" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6 max-w-4xl mx-auto">
                {/* Guidelines Sidebar */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">
                    {/* Title */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Content Title</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          value={editorState.title}
                          onChange={(e) => updateTitle(e.target.value)}
                          className="text-lg font-semibold"
                        />
                      </CardContent>
                    </Card>

                    {/* Sections */}
                    {editorState.sections.map((section, idx) => (
                      <SectionEditor
                        key={idx}
                        section={section}
                        sectionIndex={idx}
                        onContentChange={(content) => updateSectionContent(idx, content)}
                        onChildContentChange={(childIdx, content) =>
                          updateChildContent(idx, childIdx, content)
                        }
                        onAiAssist={() => handleAiAssist(idx)}
                        isAssisting={assistingSection === idx}
                      />
                    ))}

                    {/* FAQs */}
                    {editorState.faqs.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            FAQs
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {editorState.faqs.map((faq, idx) => (
                            <div key={idx} className="space-y-2">
                              <p className="text-sm font-medium">{faq.question}</p>
                              <Textarea
                                value={faq.answer}
                                onChange={(e) => updateFaqAnswer(idx, e.target.value)}
                                placeholder="Write your answer..."
                                className="min-h-[80px] resize-y"
                              />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Sidebar Panel */}
                  <div className="space-y-4">
                    {/* Content Metrics */}
                    <Card className="sticky top-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Content Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ContentMetrics editorState={editorState} item={item} />
                      </CardContent>
                    </Card>

                    {/* SEO Metadata */}
                    <SEOMetadataPanel editorState={editorState} item={item} />

                    {/* Writing Guidelines */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Writing Guidelines</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Tone */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Tone</p>
                          <ul className="space-y-1">
                            {item.tone_guidelines.map((guideline, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex gap-1.5">
                                <span className="text-primary">•</span>
                                {guideline}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Separator />

                        {/* Target Platforms */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Optimized for
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.llm_targets.map((target) => (
                              <Badge key={target} variant="secondary" className="text-xs">
                                {target.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-6 max-w-3xl mx-auto">
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <h1>{editorState.title}</h1>
                  {editorState.sections.map((section, idx) => (
                    <section key={idx}>
                      <h2>{section.heading}</h2>
                      {section.content ? (
                        section.content.split('\n\n').map((p, pIdx) => <p key={pIdx}>{p}</p>)
                      ) : (
                        <p className="text-muted-foreground italic">No content yet...</p>
                      )}
                      {section.children?.map((child, cIdx) => (
                        <div key={cIdx}>
                          <h3>{child.heading}</h3>
                          {child.content ? (
                            child.content.split('\n\n').map((p, pIdx) => <p key={pIdx}>{p}</p>)
                          ) : (
                            <p className="text-muted-foreground italic">No content yet...</p>
                          )}
                        </div>
                      ))}
                    </section>
                  ))}
                  {editorState.faqs.some((faq) => faq.answer) && (
                    <section>
                      <h2>Frequently Asked Questions</h2>
                      {editorState.faqs
                        .filter((faq) => faq.answer)
                        .map((faq, idx) => (
                          <div key={idx}>
                            <h4>{faq.question}</h4>
                            <p>{faq.answer}</p>
                          </div>
                        ))}
                    </section>
                  )}
                </article>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
