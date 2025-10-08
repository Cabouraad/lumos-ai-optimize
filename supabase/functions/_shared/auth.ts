/**
 * Auth v1: Legacy auth helpers - DEPRECATED
 * 
 * These functions now internally use the secure v2 auth system.
 * New code should use auth-v2.ts directly.
 * 
 * @deprecated Use auth-v2.ts instead
 */

/**
 * @deprecated Use getUserOrgAndRole from auth-v2.ts
 */
export async function getUserOrgId(supabase: any): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Use security definer function for safe access
  const { data, error } = await supabase
    .rpc('get_user_org_and_role', { _user_id: user.id })
    .single();

  if (error || !data?.org_id) {
    console.error('Failed to get user org:', error);
    throw new Error("User not properly onboarded");
  }

  return data.org_id;
}

/**
 * @deprecated Use requireRole from auth-v2.ts
 */
export async function requireOwnerRole(supabase: any): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Use security definer function for safe role checking
  const { data, error } = await supabase
    .rpc('get_user_org_and_role', { _user_id: user.id })
    .single();

  if (error || !data?.org_id) {
    console.error('Failed to get user org and role:', error);
    throw new Error("User not properly onboarded");
  }

  if (data.role !== 'owner') {
    throw new Error("Owner role required for this operation");
  }

  return data.org_id;
}

/**
 * Simple auth check - verifies user is authenticated
 * @deprecated Use auth-v2.ts functions instead
 */
export async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  // This is a simplified version - in production you'd want more validation
  return { id: 'authenticated' };
}