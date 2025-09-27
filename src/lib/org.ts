import { supabase } from "@/integrations/supabase/client";
import { getOrgIdSafe } from './org-id';

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

/**
 * @deprecated Use getOrgIdSafe() from './org-id' instead  
 * This export is maintained for backward compatibility
 */
export const getOrgId = getOrgIdSafe;
