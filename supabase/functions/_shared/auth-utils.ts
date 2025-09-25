/**
 * Standardized authentication utilities for edge functions
 */

import type { EdgeFunctionDiagnostics } from "./diagnostics.ts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  orgId?: string;
}

/**
 * Extract and validate Bearer token from request
 */
export function extractBearerToken(request: Request, diagnostics?: EdgeFunctionDiagnostics): string {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    const error = "Missing Authorization header";
    diagnostics?.logStep("auth_header_missing");
    throw new Error(error);
  }

  if (!authHeader.startsWith("Bearer ")) {
    const error = "Invalid Authorization header format";
    diagnostics?.logStep("auth_header_invalid_format");
    throw new Error(error);
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!token || token.length < 10) {
    const error = "Invalid or empty token";
    diagnostics?.logStep("auth_token_invalid");
    throw new Error(error);
  }

  diagnostics?.logStep("auth_token_extracted");
  return token;
}

/**
 * Authenticate user with Supabase and return user data
 */
export async function authenticateUser(
  supabaseClient: any,
  token: string,
  diagnostics?: EdgeFunctionDiagnostics
): Promise<AuthenticatedUser> {
  diagnostics?.logStep("auth_user_start");
  
  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      diagnostics?.logStep("auth_user_error", { error: userError.message });
      throw new Error(`Authentication failed: ${userError.message}`);
    }

    const user = userData.user;
    if (!user) {
      diagnostics?.logStep("auth_user_null");
      throw new Error("User not found");
    }

    if (!user.email) {
      diagnostics?.logStep("auth_user_no_email");
      throw new Error("User email not available");
    }

    diagnostics?.logStep("auth_user_success", { 
      userId: user.id, 
      emailDomain: user.email.split('@')[1] 
    });

    return {
      id: user.id,
      email: user.email
    };
  } catch (error: unknown) {
    diagnostics?.logStep("auth_user_exception", undefined, error as Error);
    throw error;
  }
}

/**
 * Get user's organization ID from database
 */
export async function getUserOrgId(
  supabaseClient: any,
  userId: string,
  diagnostics?: EdgeFunctionDiagnostics
): Promise<string> {
  diagnostics?.logStep("org_lookup_start", { userId });
  
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (error) {
      diagnostics?.logStep("org_lookup_error", { error: error.message });
      throw new Error(`Failed to get user organization: ${error.message}`);
    }

    if (!data?.org_id) {
      diagnostics?.logStep("org_lookup_no_org");
      throw new Error("User not associated with organization");
    }

    diagnostics?.logStep("org_lookup_success", { orgId: data.org_id });
    return data.org_id;
  } catch (error: unknown) {
    diagnostics?.logStep("org_lookup_exception", undefined, error as Error);
    throw error;
  }
}

/**
 * Complete authentication flow: extract token, auth user, get org
 */
export async function authenticateRequest(
  request: Request,
  supabaseClient: any,
  diagnostics?: EdgeFunctionDiagnostics,
  requireOrg = false
): Promise<AuthenticatedUser> {
  const token = extractBearerToken(request, diagnostics);
  const user = await authenticateUser(supabaseClient, token, diagnostics);
  
  if (requireOrg) {
    user.orgId = await getUserOrgId(supabaseClient, user.id, diagnostics);
  }
  
  return user;
}

/**
 * Validate environment variables required for authentication
 */
export function validateAuthEnvironment(diagnostics?: EdgeFunctionDiagnostics): void {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    diagnostics?.logStep("env_missing_url");
    throw new Error("SUPABASE_URL environment variable not set");
  }

  if (!serviceRoleKey) {
    diagnostics?.logStep("env_missing_service_key");
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable not set");
  }

  diagnostics?.logStep("env_validation_success");
}