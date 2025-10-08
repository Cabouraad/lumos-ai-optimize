/**
 * Auth v2: Secure role-based authorization using security definer functions
 * 
 * This module provides secure role checking that prevents privilege escalation attacks
 * by using security definer functions instead of querying the users table directly.
 * 
 * Migration from auth.ts:
 * - Use getUserOrgAndRole() instead of getUserOrgId() + separate role queries
 * - Use requireOwnerRole() for owner-only operations
 * - All role checks now use the user_roles table via security definer functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

export interface UserOrgAndRole {
  org_id: string;
  role: string;
}

/**
 * Get authenticated user's organization ID and role securely
 * Uses security definer function to bypass RLS and prevent privilege escalation
 * 
 * @throws Error if user is not authenticated or not properly onboarded
 */
export async function getUserOrgAndRole(supabase: any): Promise<UserOrgAndRole> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Use security definer function to get org_id and role safely
  const { data, error } = await supabase
    .rpc('get_user_org_and_role', { _user_id: user.id })
    .single();

  if (error || !data?.org_id) {
    console.error('Failed to get user org and role:', error);
    throw new Error("User not properly onboarded");
  }

  return {
    org_id: data.org_id,
    role: data.role
  };
}

/**
 * Get authenticated user's organization ID (without role)
 * Uses security definer function for secure access
 * 
 * @throws Error if user is not authenticated or not properly onboarded
 */
export async function getUserOrgId(supabase: any): Promise<string> {
  const result = await getUserOrgAndRole(supabase);
  return result.org_id;
}

/**
 * Require that the authenticated user has owner role
 * Uses security definer function to safely check role without RLS bypass risk
 * 
 * @throws Error if user is not authenticated, not onboarded, or not an owner
 * @returns The user's organization ID
 */
export async function requireOwnerRole(supabase: any): Promise<string> {
  const result = await getUserOrgAndRole(supabase);
  
  if (result.role !== 'owner') {
    throw new Error("Owner role required for this operation");
  }

  return result.org_id;
}

/**
 * Require that the authenticated user has one of the specified roles
 * 
 * @param supabase Supabase client
 * @param allowedRoles Array of roles that are allowed
 * @throws Error if user doesn't have required role
 * @returns The user's organization ID and role
 */
export async function requireRole(
  supabase: any, 
  allowedRoles: string[]
): Promise<UserOrgAndRole> {
  const result = await getUserOrgAndRole(supabase);
  
  if (!allowedRoles.includes(result.role)) {
    throw new Error(
      `Access denied: requires role in [${allowedRoles.join(', ')}], got: ${result.role}`
    );
  }

  return result;
}

/**
 * Check if the authenticated user has a specific role
 * Uses security definer function for safe role checking
 * 
 * @param supabase Supabase client
 * @param role Role to check for ('owner', 'admin', 'member')
 * @returns true if user has the role, false otherwise
 */
export async function hasRole(supabase: any, role: 'owner' | 'admin' | 'member'): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return false;
  }

  const { data, error } = await supabase
    .rpc('has_role', { _user_id: user.id, _role: role });

  if (error) {
    console.error('Failed to check role:', error);
    return false;
  }

  return data === true;
}

/**
 * Get the authenticated user's role
 * Uses security definer function for secure access
 * 
 * @returns The user's primary role or null if not found
 */
export async function getUserRole(supabase: any): Promise<string | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .rpc('get_user_role', { _user_id: user.id });

  if (error) {
    console.error('Failed to get user role:', error);
    return null;
  }

  return data;
}
