import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContentStudioItem, OutlineSection } from '../types';

export interface SectionContent {
  heading: string;
  content: string;
  suggestions: string[];
  children?: SectionContent[];
}

export interface EditorState {
  title: string;
  sections: SectionContent[];
  faqs: { question: string; answer: string }[];
}

function initializeEditorState(item: ContentStudioItem): EditorState {
  return {
    title: item.outline.title,
    sections: item.outline.sections.map((section) => ({
      heading: section.heading,
      content: '',
      suggestions: section.points,
      children: section.children?.map((child) => ({
        heading: child.heading,
        content: '',
        suggestions: child.points,
      })),
    })),
    faqs: item.faqs.map((faq) => ({
      question: faq.question,
      answer: '',
    })),
  };
}

export function useContentEditor(item: ContentStudioItem | null) {
  const [editorState, setEditorState] = useState<EditorState | null>(
    item ? initializeEditorState(item) : null
  );

  const resetEditor = useCallback((newItem: ContentStudioItem) => {
    setEditorState(initializeEditorState(newItem));
  }, []);

  const updateSectionContent = useCallback((sectionIndex: number, content: string) => {
    setEditorState((prev) => {
      if (!prev) return prev;
      const newSections = [...prev.sections];
      newSections[sectionIndex] = { ...newSections[sectionIndex], content };
      return { ...prev, sections: newSections };
    });
  }, []);

  const updateChildContent = useCallback(
    (sectionIndex: number, childIndex: number, content: string) => {
      setEditorState((prev) => {
        if (!prev) return prev;
        const newSections = [...prev.sections];
        const children = [...(newSections[sectionIndex].children || [])];
        children[childIndex] = { ...children[childIndex], content };
        newSections[sectionIndex] = { ...newSections[sectionIndex], children };
        return { ...prev, sections: newSections };
      });
    },
    []
  );

  const updateFaqAnswer = useCallback((faqIndex: number, answer: string) => {
    setEditorState((prev) => {
      if (!prev) return prev;
      const newFaqs = [...prev.faqs];
      newFaqs[faqIndex] = { ...newFaqs[faqIndex], answer };
      return { ...prev, faqs: newFaqs };
    });
  }, []);

  const updateTitle = useCallback((title: string) => {
    setEditorState((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  // AI Writing Assistance
  const aiAssist = useMutation({
    mutationFn: async ({
      context,
      sectionHeading,
      suggestions,
      existingContent,
      toneGuidelines,
      keyEntities,
    }: {
      context: string;
      sectionHeading: string;
      suggestions: string[];
      existingContent: string;
      toneGuidelines: string[];
      keyEntities: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('content-studio-assist', {
        body: {
          context,
          sectionHeading,
          suggestions,
          existingContent,
          toneGuidelines,
          keyEntities,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as { generatedContent: string };
    },
  });

  // Export functions
  const exportAsMarkdown = useCallback((): string => {
    if (!editorState) return '';

    let md = `# ${editorState.title}\n\n`;

    editorState.sections.forEach((section) => {
      md += `## ${section.heading}\n\n`;
      if (section.content) {
        md += `${section.content}\n\n`;
      }
      section.children?.forEach((child) => {
        md += `### ${child.heading}\n\n`;
        if (child.content) {
          md += `${child.content}\n\n`;
        }
      });
    });

    if (editorState.faqs.some((faq) => faq.answer)) {
      md += `## Frequently Asked Questions\n\n`;
      editorState.faqs.forEach((faq) => {
        if (faq.answer) {
          md += `**${faq.question}**\n\n${faq.answer}\n\n`;
        }
      });
    }

    return md;
  }, [editorState]);

  const exportAsHtml = useCallback((): string => {
    if (!editorState) return '';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${editorState.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; }
    h3 { color: #555; }
    p { color: #444; }
    .faq { margin: 1.5rem 0; }
    .faq-question { font-weight: 600; color: #1a1a1a; margin-bottom: 0.5rem; }
    .faq-answer { color: #444; }
  </style>
</head>
<body>
  <article>
    <h1>${editorState.title}</h1>
`;

    editorState.sections.forEach((section) => {
      html += `    <section>\n      <h2>${section.heading}</h2>\n`;
      if (section.content) {
        const paragraphs = section.content.split('\n\n').filter(Boolean);
        paragraphs.forEach((p) => {
          html += `      <p>${p.replace(/\n/g, '<br>')}</p>\n`;
        });
      }
      section.children?.forEach((child) => {
        html += `      <h3>${child.heading}</h3>\n`;
        if (child.content) {
          const paragraphs = child.content.split('\n\n').filter(Boolean);
          paragraphs.forEach((p) => {
            html += `      <p>${p.replace(/\n/g, '<br>')}</p>\n`;
          });
        }
      });
      html += `    </section>\n`;
    });

    if (editorState.faqs.some((faq) => faq.answer)) {
      html += `    <section>\n      <h2>Frequently Asked Questions</h2>\n`;
      editorState.faqs.forEach((faq) => {
        if (faq.answer) {
          html += `      <div class="faq">\n        <p class="faq-question">${faq.question}</p>\n        <p class="faq-answer">${faq.answer.replace(/\n/g, '<br>')}</p>\n      </div>\n`;
        }
      });
      html += `    </section>\n`;
    }

    html += `  </article>\n</body>\n</html>`;
    return html;
  }, [editorState]);

  const downloadContent = useCallback(
    (format: 'markdown' | 'html') => {
      const content = format === 'markdown' ? exportAsMarkdown() : exportAsHtml();
      const extension = format === 'markdown' ? 'md' : 'html';
      const mimeType = format === 'markdown' ? 'text/markdown' : 'text/html';

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${editorState?.title.toLowerCase().replace(/\s+/g, '-') || 'content'}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [editorState, exportAsMarkdown, exportAsHtml]
  );

  return {
    editorState,
    resetEditor,
    updateSectionContent,
    updateChildContent,
    updateFaqAnswer,
    updateTitle,
    aiAssist,
    exportAsMarkdown,
    exportAsHtml,
    downloadContent,
  };
}
