/**
 * Dialog for selecting content preferences before generating Content Studio blueprint
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Users, Sparkles, FileText } from 'lucide-react';
import type { ContentPreferences } from '@/features/content-studio/types';

interface ContentPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (preferences: ContentPreferences) => void;
  isGenerating?: boolean;
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-appropriate' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'technical', label: 'Technical', description: 'Detailed and precise' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { value: 'authoritative', label: 'Authoritative', description: 'Expert and confident' },
  { value: 'educational', label: 'Educational', description: 'Informative and instructive' },
];

const STYLE_OPTIONS = [
  { value: 'conversational', label: 'Conversational', description: 'Natural dialogue style' },
  { value: 'formal', label: 'Formal', description: 'Structured and polished' },
  { value: 'educational', label: 'Educational', description: 'Teaching and explaining' },
  { value: 'persuasive', label: 'Persuasive', description: 'Compelling and convincing' },
  { value: 'storytelling', label: 'Storytelling', description: 'Narrative-driven' },
  { value: 'data_driven', label: 'Data-Driven', description: 'Facts and statistics focused' },
];

const AUDIENCE_OPTIONS = [
  { value: 'beginners', label: 'Beginners', description: 'New to the topic' },
  { value: 'intermediate', label: 'Intermediate', description: 'Some existing knowledge' },
  { value: 'experts', label: 'Experts', description: 'Advanced understanding' },
  { value: 'decision_makers', label: 'Decision Makers', description: 'Business executives' },
  { value: 'technical_users', label: 'Technical Users', description: 'Developers and engineers' },
  { value: 'general_public', label: 'General Public', description: 'Wide audience' },
];

const FORMAT_OPTIONS = [
  { value: 'how_to', label: 'How-To Guide', description: 'Step-by-step instructions' },
  { value: 'listicle', label: 'Listicle', description: 'Numbered or bulleted list' },
  { value: 'comparison', label: 'Comparison', description: 'Compare options or solutions' },
  { value: 'case_study', label: 'Case Study', description: 'Real-world examples' },
  { value: 'faq', label: 'FAQ', description: 'Question and answer format' },
  { value: 'comprehensive', label: 'Comprehensive Guide', description: 'In-depth coverage' },
];

export function ContentPreferencesDialog({ 
  open, 
  onOpenChange, 
  onGenerate,
  isGenerating = false 
}: ContentPreferencesDialogProps) {
  const [preferences, setPreferences] = useState<ContentPreferences>({
    tone: 'professional',
    style: 'educational',
    audience: 'intermediate',
    format: 'how_to',
  });

  const handleGenerate = () => {
    onGenerate(preferences);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Customize Your Content Blueprint
          </DialogTitle>
          <DialogDescription>
            Choose how you want your content to sound and who it's for. These preferences will guide the AI in creating your blueprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tone Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Palette className="h-4 w-4 text-primary" />
              Tone
            </Label>
            <Select
              value={preferences.tone}
              onValueChange={(value) => setPreferences({ ...preferences, tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Writing Style
            </Label>
            <Select
              value={preferences.style}
              onValueChange={(value) => setPreferences({ ...preferences, style: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audience Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Users className="h-4 w-4 text-primary" />
              Target Audience
            </Label>
            <Select
              value={preferences.audience}
              onValueChange={(value) => setPreferences({ ...preferences, audience: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Content Format
            </Label>
            <Select
              value={preferences.format}
              onValueChange={(value) => setPreferences({ ...preferences, format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Generating Blueprint...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Content Blueprint
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
