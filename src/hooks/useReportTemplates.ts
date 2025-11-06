import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateMetrics {
  visibility_score: boolean;
  brand_mentions: boolean;
  competitor_count: boolean;
  avg_prominence: boolean;
  citation_count: boolean;
  top_prompts: boolean;
  low_visibility_prompts: boolean;
}

export interface ReportTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  include_executive_summary: boolean;
  include_visibility_overview: boolean;
  include_brand_presence: boolean;
  include_competitor_analysis: boolean;
  include_provider_performance: boolean;
  include_prompt_performance: boolean;
  include_citations_sources: boolean;
  include_historical_trends: boolean;
  include_recommendations: boolean;
  metrics: TemplateMetrics;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export function useReportTemplates(orgId?: string) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultTemplate, setDefaultTemplate] = useState<ReportTemplate | null>(null);

  useEffect(() => {
    if (orgId) {
      loadTemplates();
    }
  }, [orgId]);

  const loadTemplates = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('org_id', orgId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse metrics JSON
      const parsedData = (data || []).map(t => ({
        ...t,
        metrics: typeof t.metrics === 'string' ? JSON.parse(t.metrics) : t.metrics
      })) as ReportTemplate[];

      setTemplates(parsedData);
      
      // Set default template
      const defaultTpl = parsedData.find(t => t.is_default);
      setDefaultTemplate(defaultTpl || null);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load report templates');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by'>) => {
    if (!orgId) return null;

    try {
      const { data, error } = await supabase
        .from('report_templates')
        .insert({
          org_id: orgId,
          name: template.name,
          description: template.description,
          is_default: template.is_default,
          include_executive_summary: template.include_executive_summary,
          include_visibility_overview: template.include_visibility_overview,
          include_brand_presence: template.include_brand_presence,
          include_competitor_analysis: template.include_competitor_analysis,
          include_provider_performance: template.include_provider_performance,
          include_prompt_performance: template.include_prompt_performance,
          include_citations_sources: template.include_citations_sources,
          include_historical_trends: template.include_historical_trends,
          include_recommendations: template.include_recommendations,
          metrics: template.metrics as any,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Template created successfully');
      await loadTemplates();
      return data;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
      return null;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by'>>) => {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
      if (updates.include_executive_summary !== undefined) updateData.include_executive_summary = updates.include_executive_summary;
      if (updates.include_visibility_overview !== undefined) updateData.include_visibility_overview = updates.include_visibility_overview;
      if (updates.include_brand_presence !== undefined) updateData.include_brand_presence = updates.include_brand_presence;
      if (updates.include_competitor_analysis !== undefined) updateData.include_competitor_analysis = updates.include_competitor_analysis;
      if (updates.include_provider_performance !== undefined) updateData.include_provider_performance = updates.include_provider_performance;
      if (updates.include_prompt_performance !== undefined) updateData.include_prompt_performance = updates.include_prompt_performance;
      if (updates.include_citations_sources !== undefined) updateData.include_citations_sources = updates.include_citations_sources;
      if (updates.include_historical_trends !== undefined) updateData.include_historical_trends = updates.include_historical_trends;
      if (updates.include_recommendations !== undefined) updateData.include_recommendations = updates.include_recommendations;
      if (updates.metrics !== undefined) updateData.metrics = updates.metrics;

      const { error } = await supabase
        .from('report_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Template updated successfully');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
      return false;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('report_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Template deleted successfully');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
      return false;
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from('report_templates')
        .update({ is_default: false })
        .eq('org_id', orgId);

      // Then set the new default
      const { error } = await supabase
        .from('report_templates')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      toast.success('Default template updated');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error setting default template:', error);
      toast.error('Failed to set default template');
      return false;
    }
  };

  return {
    templates,
    defaultTemplate,
    loading,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
  };
}
