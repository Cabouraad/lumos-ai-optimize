import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Copy, 
  Check, 
  FileText, 
  HelpCircle, 
  Tag, 
  Code2, 
  MessageSquare,
  Target
} from 'lucide-react';
import type { ContentStudioItem, OutlineSection } from '../types';
import { CONTENT_TYPE_LABELS, SCHEMA_TYPE_COLORS } from '../types';

interface ContentStudioDrawerProps {
  item: ContentStudioItem | null;
  open: boolean;
  onClose: () => void;
}

export function ContentStudioDrawer({ item, open, onClose }: ContentStudioDrawerProps) {
  const [copiedOutline, setCopiedOutline] = useState(false);
  const [copiedFaqs, setCopiedFaqs] = useState(false);

  if (!item) return null;

  const handleCopyOutline = async () => {
    const outlineText = formatOutlineAsText(item.outline);
    await navigator.clipboard.writeText(outlineText);
    setCopiedOutline(true);
    setTimeout(() => setCopiedOutline(false), 2000);
  };

  const handleCopyFaqs = async () => {
    const faqsText = item.faqs
      .map((faq) => `Q: ${faq.question}\nA: ${faq.answer_notes}`)
      .join('\n\n');
    await navigator.clipboard.writeText(faqsText);
    setCopiedFaqs(true);
    setTimeout(() => setCopiedFaqs(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-lg">Content Studio</SheetTitle>
            <Badge variant="secondary" className="text-xs">
              {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
            </Badge>
          </div>
          <SheetDescription className="text-sm line-clamp-2">
            {item.topic_key}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 pr-4">
          <div className="space-y-6">
            {/* LLM Targets */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Target Platforms</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.llm_targets.map((target) => (
                  <Badge key={target} variant="outline" className="text-xs">
                    {target.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator />

            {/* Outline */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Content Outline</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOutline}
                  className="h-7 text-xs"
                >
                  {copiedOutline ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiedOutline ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold text-base mb-3">{item.outline.title}</h4>
                <Accordion type="multiple" className="space-y-2">
                  {item.outline.sections.map((section, idx) => (
                    <OutlineSectionItem key={idx} section={section} index={idx} />
                  ))}
                </Accordion>
              </div>
            </section>

            <Separator />

            {/* FAQs */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Suggested FAQs ({item.faqs.length})</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyFaqs}
                  className="h-7 text-xs"
                >
                  {copiedFaqs ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiedFaqs ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              
              <div className="space-y-3">
                {item.faqs.map((faq, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-sm mb-1">{faq.question}</p>
                    <p className="text-sm text-muted-foreground">{faq.answer_notes}</p>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Key Entities */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Key Entities to Include</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.key_entities.map((entity, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {entity}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator />

            {/* Schema Suggestions */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Schema Markup Suggestions</h3>
              </div>
              <div className="space-y-2">
                {item.schema_suggestions.map((schema, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-muted/50 rounded-lg p-3"
                  >
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${SCHEMA_TYPE_COLORS[schema.type] || ''}`}
                    >
                      {schema.type}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{schema.notes}</p>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Tone Guidelines */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Tone Guidelines</h3>
              </div>
              <ul className="space-y-1">
                {item.tone_guidelines.map((guideline, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {guideline}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function OutlineSectionItem({ section, index }: { section: OutlineSection; index: number }) {
  return (
    <AccordionItem value={`section-${index}`} className="border rounded-lg px-3">
      <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
        {section.heading}
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <ul className="space-y-1 ml-4">
          {section.points.map((point, pIdx) => (
            <li key={pIdx} className="text-sm text-muted-foreground list-disc">
              {point}
            </li>
          ))}
        </ul>
        {section.children && section.children.length > 0 && (
          <div className="mt-3 ml-4 space-y-2">
            {section.children.map((child, cIdx) => (
              <div key={cIdx} className="border-l-2 border-muted pl-3">
                <p className="text-sm font-medium">{child.heading}</p>
                <ul className="mt-1 space-y-1 ml-4">
                  {child.points.map((point, pIdx) => (
                    <li key={pIdx} className="text-xs text-muted-foreground list-disc">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function formatOutlineAsText(outline: ContentStudioItem['outline']): string {
  let text = `# ${outline.title}\n\n`;
  
  outline.sections.forEach((section, idx) => {
    text += `## ${idx + 1}. ${section.heading}\n`;
    section.points.forEach((point) => {
      text += `- ${point}\n`;
    });
    
    if (section.children) {
      section.children.forEach((child) => {
        text += `\n### ${child.heading}\n`;
        child.points.forEach((point) => {
          text += `  - ${point}\n`;
        });
      });
    }
    text += '\n';
  });
  
  return text;
}
