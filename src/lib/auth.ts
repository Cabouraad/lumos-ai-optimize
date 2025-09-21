import { supabase } from "@/integrations/supabase/client";

export async function getOrgId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_current_user_org_id');
  console.log('🔍 Debug getOrgId RPC:', { data, error });
  if (error || !data) {
    throw new Error("Onboarding incomplete: no org membership");
  }
  return data as string;
}