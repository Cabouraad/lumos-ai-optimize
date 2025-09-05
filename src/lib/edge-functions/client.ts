import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

/**
 * Enhanced edge function client with proper logging and error handling
 */
export class EdgeFunctionClient {
  /**
   * Call an edge function with enhanced logging and error handling
   */
  static async invoke<T = any>(
    functionName: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Get current session for logging
      const { data: { session } } = await supabase.auth.getSession();
      
      console.debug("Edge call:", functionName, {
        hasToken: !!session?.access_token,
        body: options.body ? Object.keys(options.body) : undefined,
        headers: options.headers ? Object.keys(options.headers) : undefined
      });

      // Call the edge function using Supabase client
      const result = await supabase.functions.invoke(functionName, {
        body: options.body,
        headers: options.headers || {}
      });

      if (result.error) {
        console.error(`[${functionName}] Edge function returned error:`, result.error);
        throw result.error;
      }

      console.debug(`[${functionName}] Success:`, result.data);
      return result;

    } catch (error: any) {
      console.error(`[${functionName}] Network/client error:`, {
        name: error.name,
        message: error.message,
        isFetchError: error.__isFetchError,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // Enhanced error logging for debugging
      if (error.response) {
        try {
          const responseText = await error.response.text();
          console.error(`[${functionName}] Response text:`, responseText);
        } catch (textError) {
          console.error(`[${functionName}] Could not read response text:`, textError);
        }
      }

      // Show user-friendly toast notification
      const errorMessage = this.getErrorMessage(error);
      const statusCode = error.response?.status;
      
      toast({
        title: `Error calling ${functionName}`,
        description: statusCode 
          ? `${statusCode}: ${errorMessage}` 
          : errorMessage,
        variant: "destructive",
      });

      return { data: null, error };
    }
  }

  /**
   * Extract user-friendly error message from error object
   */
  private static getErrorMessage(error: any): string {
    if (error.message) {
      return error.message;
    }
    
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          return "Invalid request";
        case 401:
          return "Authentication required";
        case 403:
          return "Access denied";
        case 404:
          return "Function not found";
        case 429:
          return "Too many requests";
        case 500:
          return "Server error";
        default:
          return `HTTP ${error.response.status}`;
      }
    }

    if (error.__isFetchError) {
      return "Network connection error";
    }

    return "Unknown error";
  }

  /**
   * Convenience methods for specific pricing/trial functions
   */
  static async checkSubscription() {
    return this.invoke('check-subscription');
  }

  static async createTrialCheckout() {
    return this.invoke('create-trial-checkout');
  }

  static async activateTrial(sessionId: string) {
    return this.invoke('activate-trial', {
      body: { sessionId }
    });
  }

  static async grantStarterBypass() {
    return this.invoke('grant-starter-bypass');
  }
}