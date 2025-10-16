import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateEnvironment, getEnvironmentErrorMessage } from "@/lib/environment/validator";

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface EnhancedInvokeOptions {
  body?: any;
  headers?: Record<string, string>;
  retries?: number;
  timeout?: number;
  correlationId?: string;
}

interface AuthValidation {
  isValid: boolean;
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Enhanced edge function client with environment validation, circuit breaker,
 * and comprehensive error handling
 */
export class EnhancedEdgeFunctionClient {
  private static circuitBreakers = new Map<string, CircuitBreakerState>();
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly RESET_TIMEOUT = 30000; // 30 seconds
  
  // Functions that don't require client-side auth (they handle their own auth with cron-secret or other means)
  private static readonly PUBLIC_FUNCTIONS = new Set([
    'robust-batch-processor', // Has internal Bearer OR cron-secret validation
    'batch-reconciler',
    'daily-batch-trigger',
    'scheduler-postcheck',
    'scheduler-diagnostics',
    'manual-daily-run'
  ]);
  
  /**
   * Validate environment before making requests
   */
  private static validateEnvironmentForRequest(): { isValid: boolean; error?: string } {
    const envStatus = validateEnvironment();
    if (!envStatus.isValid) {
      const errorMsg = getEnvironmentErrorMessage(envStatus);
      console.error('❌ Environment validation failed:', errorMsg);
      return { isValid: false, error: errorMsg };
    }
    return { isValid: true };
  }

  /**
   * Check authentication status with server-side validation
   */
  private static async validateAuthentication(): Promise<AuthValidation> {
    try {
      // CRITICAL: Use getUser() instead of getSession()
      // getUser() validates with the server, getSession() only reads localStorage
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('❌ Authentication error:', error);
        
        // Detect stale token error specifically
        if (error.message.includes('User from sub claim in JWT does not exist') ||
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('JWT expired')) {
          console.log('🧹 Detected stale token, clearing session...');
          await supabase.auth.signOut();
          return { 
            isValid: false, 
            error: 'Your session is invalid. Please sign in again.',
            requiresReauth: true 
          };
        }
        
        return { isValid: false, error: `Authentication error: ${error.message}` };
      }
      
      if (!user) {
        console.error('❌ No authenticated user found');
        return { isValid: false, error: 'Authentication required - please sign in' };
      }
      
      console.log('✅ User authenticated:', user.id);
      return { isValid: true };
    } catch (error: any) {
      console.error('❌ Authentication validation failed:', error);
      return { isValid: false, error: `Authentication validation failed: ${error.message}` };
    }
  }

  /**
   * Circuit breaker implementation
   */
  private static getCircuitBreakerState(functionName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(functionName)) {
      this.circuitBreakers.set(functionName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED'
      });
    }
    return this.circuitBreakers.get(functionName)!;
  }

  private static updateCircuitBreaker(functionName: string, success: boolean): void {
    const breaker = this.getCircuitBreakerState(functionName);
    
    if (success) {
      breaker.failures = 0;
      breaker.state = 'CLOSED';
    } else {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failures >= this.FAILURE_THRESHOLD) {
        breaker.state = 'OPEN';
        console.warn(`🔴 Circuit breaker OPEN for ${functionName} (${breaker.failures} failures)`);
      }
    }
  }

  private static canExecuteRequest(functionName: string): { canExecute: boolean; error?: string } {
    const breaker = this.getCircuitBreakerState(functionName);
    
    if (breaker.state === 'CLOSED') {
      return { canExecute: true };
    }
    
    if (breaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - breaker.lastFailureTime;
      
      if (timeSinceFailure > this.RESET_TIMEOUT) {
        breaker.state = 'HALF_OPEN';
        console.log(`🟡 Circuit breaker HALF_OPEN for ${functionName}`);
        return { canExecute: true };
      }
      
      return { 
        canExecute: false, 
        error: `Service temporarily unavailable (circuit breaker active). Try again in ${Math.ceil((this.RESET_TIMEOUT - timeSinceFailure) / 1000)} seconds.` 
      };
    }
    
    // HALF_OPEN state - allow one request through
    return { canExecute: true };
  }

  /**
   * Enhanced invoke with comprehensive validation and error handling
   */
  static async invoke<T = any>(
    functionName: string,
    options: EnhancedInvokeOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    const {
      body,
      headers = {},
      retries = 2,
      timeout = 90000,
      correlationId = crypto.randomUUID()
    } = options;

    console.debug(`🔄 [${correlationId}] Enhanced edge call:`, functionName, {
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : undefined,
      headerKeys: Object.keys(headers),
      retries,
      timeout
    });

    // Environment validation
    const envValidation = this.validateEnvironmentForRequest();
    if (!envValidation.isValid) {
      const error = new Error(envValidation.error || 'Environment validation failed');
      toast.error('Configuration Error', {
        description: 'Please check your environment setup and try again.'
      });
      return { data: null, error };
    }

    // Authentication validation - skip for public functions that handle their own auth
    const isPublicFunction = this.PUBLIC_FUNCTIONS.has(functionName);
    
    if (!isPublicFunction) {
      const authValidation = await this.validateAuthentication();
      if (!authValidation.isValid) {
        const error = new Error(authValidation.error || 'Authentication failed');
        
        // If stale token detected, redirect to login
        if (authValidation.requiresReauth) {
          toast.error('Session Expired', {
            description: 'Your session is no longer valid. Redirecting to login...'
          });
          setTimeout(() => {
            window.location.href = '/auth';
          }, 2000);
        } else {
          toast.error('Authentication Required', {
            description: authValidation.error || 'Please sign in and try again.'
          });
        }
        
        return { data: null, error };
      }
    } else {
      console.log(`⚡ Skipping client-side auth validation for public function: ${functionName}`);
    }

    // Circuit breaker check
    const circuitCheck = this.canExecuteRequest(functionName);
    if (!circuitCheck.canExecute) {
      const error = new Error(circuitCheck.error || 'Service unavailable');
      toast.error('Service Temporarily Unavailable', {
        description: circuitCheck.error
      });
      return { data: null, error };
    }

    // Execute with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.debug(`🔄 [${correlationId}] Attempt ${attempt + 1}/${retries + 1} for ${functionName}`);
        
        // Pass-through headers (avoid custom headers that trigger CORS)
        const enhancedHeaders = {
          ...headers
        };

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        );

        // Make the actual request
        const requestPromise = supabase.functions.invoke(functionName, {
          body,
          headers: enhancedHeaders
        });

        const result = await Promise.race([requestPromise, timeoutPromise]) as any;

        if (result.error) {
          console.error(`❌ [${correlationId}] ${functionName} returned error:`, result.error);
          throw new Error(result.error.message || `${functionName} failed`);
        }

        console.debug(`✅ [${correlationId}] ${functionName} success:`, result.data?.action || 'success');
        
        // Update circuit breaker on success
        this.updateCircuitBreaker(functionName, true);
        
        return result;

      } catch (error: any) {
        console.error(`❌ [${correlationId}] ${functionName} attempt ${attempt + 1} error:`, {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n')[0]
        });

        const isNetworkError = this.isNetworkError(error);
        const isRateLimitError = error.message?.includes('429') || error.status === 429;
        const isRetryableError = isNetworkError || error.message?.includes('timeout') || isRateLimitError;

        // If this is the last attempt or non-retryable error
        if (attempt === retries || !isRetryableError) {
          // Don't trip circuit breaker for robust-batch-processor timeouts
          // (it may legitimately take longer during heavy processing)
          const isProcessorTimeout = functionName === 'robust-batch-processor' && 
                                     (error.message?.includes('timeout') || 
                                      error.message?.includes('timed out'));
          
          // Update circuit breaker on failure (but not for rate limits or batch processor timeouts)
          if (!isRateLimitError && !isProcessorTimeout) {
            this.updateCircuitBreaker(functionName, false);
          }

          // Show user-friendly error message
          const userMessage = this.getUserFriendlyErrorMessage(error, functionName);
          toast.error('Request Failed', {
            description: userMessage
          });

          return { data: null, error };
        }

        // Wait before retry with exponential backoff (longer for rate limits)
        const baseBackoffMs = isRateLimitError ? 2000 : 1000;
        const backoffMs = Math.min(baseBackoffMs * Math.pow(2, attempt), 10000);
        console.log(`🔄 [${correlationId}] ${isRateLimitError ? 'Rate limited - ' : ''}Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // This should never be reached, but TypeScript requires it
    return { data: null, error: new Error('Unexpected error') };
  }

  /**
   * Check if error is network-related
   */
  private static isNetworkError(error: any): boolean {
    return error.message?.includes('Failed to fetch') || 
           error.message?.includes('network') ||
           error.message?.includes('NetworkError') ||
           error.name === 'TypeError' && error.message?.includes('fetch') ||
           error.message?.includes('timeout');
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyErrorMessage(error: any, functionName: string): string {
    if (error.message?.includes('timeout')) {
      return `Request to ${functionName} timed out. Please try again.`;
    }
    
    if (this.isNetworkError(error)) {
      return `Connection failed. Please check your internet connection and try again.`;
    }
    
    if (error.message?.includes('401') || error.message?.includes('Authentication')) {
      return 'Authentication required. Please sign in and try again.';
    }
    
    if (error.message?.includes('403')) {
      return 'Access denied. Please check your permissions.';
    }
    
    if (error.message?.includes('429') || error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      return 'Server error. Please try again in a few moments.';
    }
    
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Get circuit breaker status for monitoring
   */
  static getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.circuitBreakers);
  }

  /**
   * Reset circuit breaker for a specific function (for testing/admin)
   */
  static resetCircuitBreaker(functionName: string): void {
    this.circuitBreakers.delete(functionName);
    console.log(`🔄 Circuit breaker reset for ${functionName}`);
  }
}