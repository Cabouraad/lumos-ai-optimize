import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export function useBrands() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brands = [], isLoading, error } = useQuery({
    queryKey: ['brands', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Brand[];
    },
    enabled: !!user,
  });

  const createBrand = useMutation({
    mutationFn: async (brandData: { name: string; domain: string }) => {
      // Get user's org_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user!.id)
        .single();

      if (!userData?.org_id) throw new Error('Organization not found');

      const { data, error } = await supabase
        .from('brands')
        .insert([{ ...brandData, org_id: userData.org_id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({
        title: 'Brand created',
        description: 'Your new brand has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating brand',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteBrand = useMutation({
    mutationFn: async (brandId: string) => {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({
        title: 'Brand deleted',
        description: 'The brand has been removed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting brand',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    brands,
    isLoading,
    error,
    createBrand: createBrand.mutate,
    deleteBrand: deleteBrand.mutate,
    isCreating: createBrand.isPending,
    isDeleting: deleteBrand.isPending,
  };
}
