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
      maxPrompts = 10 
    }: { 
      orgContext: { name: string; description?: string };
      maxPrompts?: number;
    }) => {
      // Get prompts under 100% visibility
      const promptsData = await analyzePromptVisibility(userData?.org_id!);
      const targetPrompts = promptsData
        .sort((a, b) => a.visibility_percentage - b.visibility_percentage) // Lowest visibility first
        .slice(0, maxPrompts);

      const allOptimizations: ContentOptimization[] = [];
      
      // Generate optimizations for each prompt
      for (const promptData of targetPrompts) {
        try {
          const result = await generateContentOptimizations(promptData, orgContext);
          
          // Save optimizations
          for (const optimization of result.optimizations) {
            try {
              const optimizationId = await saveOptimization(optimization);
              allOptimizations.push({
                ...optimization,
                id: optimizationId,
                created_at: new Date().toISOString()
              });
            } catch (error) {
              console.error('Failed to save optimization for prompt:', promptData.id, error);
            }
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error('Failed to generate optimizations for prompt:', promptData.id, error);
        }
      }
      
      return { 
        optimizations: allOptimizations,
        promptsProcessed: targetPrompts.length
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