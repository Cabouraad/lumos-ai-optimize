import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserProvider';
import { toast } from '@/hooks/use-toast';
import {
  analyzePromptVisibility,
  generateContentOptimizations,
  getVisibilityAnalysis,
  getOptimizationsForOrg,
  getOptimizationsForPrompt,
  saveOptimization
} from './api';
import { PromptVisibilityData, ContentOptimization, VisibilityAnalysis } from './types';

/**
 * React hooks for the new visibility optimization system
 */

export function usePromptVisibilityAnalysis() {
  const { userData } = useUser();
  const orgId = userData?.org_id;

  return useQuery({
    queryKey: ['prompt-visibility-analysis', orgId],
    queryFn: () => analyzePromptVisibility(orgId!),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false
  });
}

export function useVisibilityAnalysis() {
  const { userData } = useUser();
  const orgId = userData?.org_id;

  return useQuery({
    queryKey: ['visibility-analysis', orgId],
    queryFn: () => getVisibilityAnalysis(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
}

export function useContentOptimizations() {
  const { userData } = useUser();
  const orgId = userData?.org_id;

  return useQuery({
    queryKey: ['content-optimizations', orgId],
    queryFn: () => getOptimizationsForOrg(orgId!),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePromptOptimizations(promptId: string) {
  return useQuery({
    queryKey: ['prompt-optimizations', promptId],
    queryFn: () => getOptimizationsForPrompt(promptId),
    enabled: !!promptId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGenerateOptimizations() {
  const queryClient = useQueryClient();
  const { userData } = useUser();

  return useMutation({
    mutationFn: async ({ 
      promptData, 
      orgContext 
    }: { 
      promptData: PromptVisibilityData; 
      orgContext: { name: string; description?: string }; 
    }) => {
      const result = await generateContentOptimizations(promptData, orgContext);
      
      // Save each optimization to the database
      const savedOptimizations: ContentOptimization[] = [];
      for (const optimization of result.optimizations) {
        try {
          const optimizationId = await saveOptimization(optimization);
          savedOptimizations.push({
            ...optimization,
            id: optimizationId,
            created_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to save optimization:', error);
        }
      }
      
      return { optimizations: savedOptimizations };
    },
    onSuccess: (data) => {
      toast({
        title: "Optimizations Generated",
        description: `Generated ${data.optimizations.length} specific content recommendations`,
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['content-optimizations'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-optimizations'] });
    },
    onError: (error) => {
      console.error('Error generating optimizations:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate optimizations",
        variant: "destructive",
      });
    }
  });
}

export function useBatchGenerateOptimizations() {
  const queryClient = useQueryClient();
  const { userData } = useUser();

  return useMutation({
    mutationFn: async ({ 
      orgContext,
      maxPrompts = 5 
    }: { 
      orgContext: { name: string; description?: string };
      maxPrompts?: number;
    }) => {
      // Call the edge function directly for batch processing
      const { data, error } = await supabase.functions.invoke('generate-optimizations', {
        body: {
          batch: true,
          category: 'low_visibility' // Focus on prompts that need improvement
        }
      });

      if (error) {
        console.error('Error calling batch generate-optimizations:', error);
        throw error;
      }
      
      const optimizations = (data?.optimizations || []).map((opt: any) => ({
        id: crypto.randomUUID(),
        type: opt.content_type || 'social_post',
        title: opt.title || 'Optimization',
        description: opt.body || '',
        content_specifications: opt.implementation_details || {},
        distribution_strategy: opt.resources || [],
        impact_assessment: opt.success_metrics || {},
        implementation_plan: {
          steps: opt.implementation_details?.steps || [],
          timeline: opt.timeline_weeks || 4,
          difficulty: opt.difficulty_level || 'medium'
        },
        content_strategy: opt.reddit_strategy || {},
        priority_score: opt.impact_score || 50,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      return { 
        optimizations,
        promptsProcessed: data?.promptsProcessed || 0
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Generation Complete",
        description: `Generated ${data.optimizations.length} optimizations for ${data.promptsProcessed} prompts`,
      });
      
      // Invalidate all optimization queries
      queryClient.invalidateQueries({ queryKey: ['content-optimizations'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-optimizations'] });
      queryClient.invalidateQueries({ queryKey: ['visibility-analysis'] });
    },
    onError: (error) => {
      console.error('Error in batch generation:', error);
      toast({
        title: "Batch Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate optimizations",
        variant: "destructive",
      });
    }
  });
}

export function useMarkOptimizationComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optimizationId: string) => {
      // This would update the optimization status in the database
      // For now, we'll just simulate the API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return optimizationId;
    },
    onSuccess: () => {
      toast({
        title: "Optimization Marked Complete",
        description: "Great job! This will help improve your AI visibility.",
      });
      
      queryClient.invalidateQueries({ queryKey: ['content-optimizations'] });
    }
  });
}