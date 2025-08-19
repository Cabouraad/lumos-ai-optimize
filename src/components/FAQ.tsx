import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HelpCircle, MessageSquare, Users, FileText, Lightbulb, Play, Eye, Download, Copy, Plus } from 'lucide-react';

interface FAQProps {
  page: string;
}

const faqContent: Record<string, { title: string; sections: Array<{ question: string; answer: string; tips?: string[] }> }> = {
  '/prompts': {
    title: 'Prompts - How to Use',
    sections: [
      {
        question: 'What are prompts and why are they important?',
        answer: 'Prompts are questions or queries that users might ask AI systems about your business. By monitoring how well AI systems mention your brand in responses to relevant prompts, you can optimize your online presence for AI-driven search.',
        tips: [
          'Focus on prompts your target audience would actually ask',
          'Include both broad industry questions and specific use-case queries',
          'Monitor competitor mentions to identify opportunities'
        ]
      },
      {
        question: 'How do I add new prompts?',
        answer: 'Click the "Add Prompt" button and enter a question or query that potential customers might ask AI systems. Make sure it\'s relevant to your business and industry.',
        tips: [
          'Use natural language as if a real person were asking',
          'Include questions about your competitors to monitor the landscape',
          'Test different variations of similar questions'
        ]
      },
      {
        question: 'How do I run prompts and check results?',
        answer: 'Click the "Run Now" button next to any prompt to test it against enabled AI providers. You\'ll see visibility scores, brand mentions, and competitor analysis.',
        tips: [
          'Run prompts regularly to track changes over time',
          'Check results across different AI providers for comprehensive coverage',
          'Look for patterns in low-scoring prompts to identify content gaps'
        ]
      },
      {
        question: 'What do the visibility scores mean?',
        answer: 'Visibility scores (0-10) indicate how well your brand appears in AI responses. Higher scores mean better visibility, positioning, and fewer competitors mentioned.',
        tips: [
          'Scores below 4 indicate opportunities for improvement',
          'Focus on prompts where competitors consistently outrank you',
          'Use low scores to guide content creation priorities'
        ]
      }
    ]
  },
  '/competitors': {
    title: 'Competitors - Understanding the Landscape',
    sections: [
      {
        question: 'How does competitor tracking work?',
        answer: 'When you run prompts, our system automatically detects and tracks mentions of other brands and companies in AI responses. This helps you understand your competitive landscape in AI-driven search results.',
        tips: [
          'Competitors are automatically detected from AI responses',
          'Higher appearance counts indicate stronger AI visibility',
          'Track trends to see which competitors are gaining or losing ground'
        ]
      },
      {
        question: 'What do the competitor metrics mean?',
        answer: 'Total Appearances shows how often a competitor appears in AI responses. Share Percentage indicates their relative visibility compared to others. Trends show whether their visibility is increasing or decreasing.',
        tips: [
          'Focus on competitors with high share percentages',
          'Monitor rising competitors (positive trends) closely',
          'Learn from competitors who rank well in your key prompts'
        ]
      },
      {
        question: 'How can I improve against competitors?',
        answer: 'Analyze which prompts competitors dominate, study their content strategies, and create better, more comprehensive content that addresses the same topics AI systems reference.',
        tips: [
          'Check which prompts your top competitors consistently appear in',
          'Create content that directly addresses those topics',
          'Monitor changes after publishing new content'
        ]
      }
    ]
  },
  '/llms-txt': {
    title: 'LLMs.txt Generator - AI Optimization',
    sections: [
      {
        question: 'What is an llms.txt file and why do I need it?',
        answer: 'An llms.txt file is like robots.txt but for AI systems. It provides structured information about your website to help AI models give more accurate and relevant responses about your business.',
        tips: [
          'Similar to how robots.txt guides search engines',
          'Helps AI systems understand your business better',
          'Can improve how accurately AI systems represent your brand'
        ]
      },
      {
        question: 'How do I use the generator?',
        answer: 'Fill in your site information, business details, and key pages. The generator automatically loads data from your organization settings. Then generate, copy, and upload the file to your website root.',
        tips: [
          'Most fields auto-populate from your organization settings',
          'Add key pages that best represent your business',
          'Include contact information for AI fact-checking'
        ]
      },
      {
        question: 'Where should I put the llms.txt file?',
        answer: 'Upload the generated file to your website\'s root directory (same level as robots.txt). It should be accessible at yoursite.com/llms.txt',
        tips: [
          'Place it in the root directory, not in subfolders',
          'Make sure it\'s publicly accessible',
          'Test the URL after uploading to confirm it works'
        ]
      },
      {
        question: 'How often should I update my llms.txt?',
        answer: 'Update your llms.txt file whenever you launch new products, change your business focus, or update key website pages. Keep the information current for best results.',
        tips: [
          'Review and update quarterly at minimum',
          'Update after major business changes',
          'Keep product and service descriptions current'
        ]
      }
    ]
  },
  '/recommendations': {
    title: 'Recommendations - AI-Driven Insights',
    sections: [
      {
        question: 'How are recommendations generated?',
        answer: 'Our AI analyzes your prompt performance, competitor mentions, citation patterns, and visibility trends to generate specific, actionable recommendations for improving your AI search presence.',
        tips: [
          'Based on real data from your prompt runs',
          'Updated automatically as new data comes in',
          'Prioritized by potential impact and feasibility'
        ]
      },
      {
        question: 'What types of recommendations will I see?',
        answer: 'You\'ll see content creation suggestions, competitive positioning advice, SEO optimization tips, and technical improvements to boost your visibility in AI-powered search results.',
        tips: [
          'Content hubs for topics where you\'re not mentioned',
          'Competitive analysis for areas where rivals dominate',
          'Technical optimizations like llms.txt files',
          'Citation-building opportunities from AI responses'
        ]
      },
      {
        question: 'How do I prioritize recommendations?',
        answer: 'Focus on recommendations with higher estimated impact percentages first. Also consider your resources and which recommendations align best with your content strategy.',
        tips: [
          'Start with high-impact, low-effort recommendations',
          'Tackle content gaps in your most important topic areas',
          'Address competitive threats in key prompts',
          'Implement technical fixes (like llms.txt) early'
        ]
      },
      {
        question: 'How do I track if recommendations are working?',
        answer: 'After implementing recommendations, monitor your visibility scores for related prompts, track competitor share changes, and watch for improvements in brand mention frequency.',
        tips: [
          'Allow 2-4 weeks for content changes to take effect',
          'Monitor specific prompts mentioned in the recommendations',
          'Track overall visibility score trends',
          'Look for reduced competitor dominance in key areas'
        ]
      }
    ]
  }
};

export function FAQ({ page }: FAQProps) {
  const [open, setOpen] = useState(false);
  const content = faqContent[page];

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="w-4 h-4" />
          FAQ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HelpCircle className="w-5 h-5 text-primary" />
            {content.title}
          </DialogTitle>
          <DialogDescription>
            Learn how to effectively use the tools on this page to optimize your AI search presence.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {content.sections.map((section, index) => (
            <div key={index} className="space-y-3">
              <h3 className="font-semibold text-lg text-foreground">
                {section.question}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {section.answer}
              </p>
              
              {section.tips && section.tips.length > 0 && (
                <div className="space-y-2">
                  <Badge variant="secondary" className="text-xs">
                    💡 Pro Tips
                  </Badge>
                  <ul className="space-y-1 ml-4">
                    {section.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {index < content.sections.length - 1 && <Separator />}
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Need more help? Check out our{' '}
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <a href="https://docs.lovable.dev" target="_blank" rel="noopener noreferrer">
                documentation
              </a>
            </Button>
            {' '}or contact support.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}