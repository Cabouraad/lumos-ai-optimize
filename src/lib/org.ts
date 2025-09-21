import { supabase } from "@/integrations/supabase/client";

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/** Returns { orgId, role } or null if user has not been onboarded */
export async function getOrgMembership() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
    
  if (error) throw error;
  return data ?? null;
}

/** Get current user's org ID or throw if not onboarded */
export async function getOrgId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_current_user_org_id');
  if (error || !data) {
    throw new Error('Onboarding incomplete: no org membership');
  }
  return data as string;
}