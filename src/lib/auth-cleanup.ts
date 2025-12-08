import { supabase } from "@/integrations/supabase/client";
import { clearOrgIdCache } from "./org-id";

export function cleanupAuthState() {
  // Clear org ID cache to prevent cross-user data leakage
  clearOrgIdCache();
  
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
  
  // Clear onboarding-related data to prevent cross-user contamination
  sessionStorage.removeItem('onboarding-data');
  sessionStorage.removeItem('selected-plan');
  sessionStorage.removeItem('billing-cycle');
}

export async function signInWithCleanup(email: string, password: string, redirectPath?: string) {
  try {
    // Clean up existing state
    cleanupAuthState();
    
    // Attempt global sign out
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      // Continue even if this fails
    }
    
    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data.user) {
      // For password-based login, session is already established
      // Bootstrap to determine proper destination (dashboard vs onboarding vs pricing)
      try {
        const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke('bootstrap-auth');
        
        if (!bootstrapError && bootstrapData?.success) {
          if (bootstrapData.org_id) {
            // User has organization - check subscription
            const { data: subData } = await supabase.functions.invoke('check-subscription');
            
            if (subData?.hasAccess) {
              // Has org and subscription - go to dashboard
              window.location.href = redirectPath || '/dashboard';
            } else {
              // Has org but no subscription - check for redirect path (e.g., black-friday)
              window.location.href = redirectPath || '/pricing';
            }
          } else {
            // No organization - send to onboarding
            window.location.href = '/onboarding';
          }
        } else {
          // Bootstrap failed - default to dashboard, let ProtectedRoute handle redirects
          window.location.href = redirectPath || '/dashboard';
        }
      } catch (bootstrapError) {
        console.warn('Bootstrap failed:', bootstrapError);
        // Default to dashboard, let ProtectedRoute handle redirects
        window.location.href = redirectPath || '/dashboard';
      }
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOutWithCleanup() {
  try {
    // Clean up auth state
    cleanupAuthState();
    
    // Attempt global sign out (fallback if it fails)
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      // Ignore errors
    }
    
    // Force page reload for a clean state
    window.location.href = '/auth';
  } catch (error) {
    console.error('Error during sign out:', error);
  }
}