import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ReportTemplate } from '@/hooks/useReportTemplates';

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ReportTemplate;
  onSave: (template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by'>) => Promise<void>;
}

export function TemplateEditor({ open, onOpenChange, template, onSave }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Section toggles
  const [sections, setSections] = useState({
    include_executive_summary: true,
    include_visibility_overview: true,
    include_brand_presence: true,
    include_competitor_analysis: true,
    include_provider_performance: true,
    include_prompt_performance: true,
    include_citations_sources: true,
    include_historical_trends: true,
    include_recommendations: true,
  });

  // Metrics
  const [metrics, setMetrics] = useState({
    visibility_score: true,
    brand_mentions: true,
    competitor_count: true,
    avg_prominence: true,
    citation_count: true,
    top_prompts: true,
    low_visibility_prompts: true,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsDefault(template.is_default);
      setSections({
        include_executive_summary: template.include_executive_summary,
        include_visibility_overview: template.include_visibility_overview,
        include_brand_presence: template.include_brand_presence,
        include_competitor_analysis: template.include_competitor_analysis,
        include_provider_performance: template.include_provider_performance,
        include_prompt_performance: template.include_prompt_performance,
        include_citations_sources: template.include_citations_sources,
        include_historical_trends: template.include_historical_trends,
        include_recommendations: template.include_recommendations,
      });
      setMetrics(template.metrics);
    } else {
      // Reset to defaults for new template
      setName('');
      setDescription('');
      setIsDefault(false);
      setSections({
        include_executive_summary: true,
        include_visibility_overview: true,
        include_brand_presence: true,
        include_competitor_analysis: true,
        include_provider_performance: true,
        include_prompt_performance: true,
        include_citations_sources: true,
        include_historical_trends: true,
        include_recommendations: true,
      });
      setMetrics({
        visibility_score: true,
        brand_mentions: true,
        competitor_count: true,
        avg_prominence: true,
        citation_count: true,
        top_prompts: true,
        low_visibility_prompts: true,
      });
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        is_default: isDefault,
        ...sections,
        metrics,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create Report Template'}</DialogTitle>
          <DialogDescription>
            Customize which sections and metrics are included in your reports
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Executive Summary Only"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this template includes..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  Set as default template
                </Label>
              </div>
            </div>

            <Separator />

            {/* Report Sections */}
            <div className="space-y-3">
              <h4 className="font-medium">Report Sections</h4>
              <div className="space-y-3">
                {Object.entries(sections).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="cursor-pointer font-normal">
                      {key.replace('include_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setSections(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Metrics */}
            <div className="space-y-3">
              <h4 className="font-medium">Metrics</h4>
              <div className="space-y-3">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`metric_${key}`} className="cursor-pointer font-normal">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <Switch
                      id={`metric_${key}`}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setMetrics(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
