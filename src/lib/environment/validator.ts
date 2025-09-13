/**
 * Environment validation and configuration utilities
 */

export interface EnvironmentStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * Validate essential environment variables and Supabase configuration
 */
export function validateEnvironment(): EnvironmentStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check Supabase URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is not configured');
  } else if (!supabaseUrl.startsWith('https://')) {
    warnings.push('Supabase URL should use HTTPS');
  }
  
  // Check Supabase anon key
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseKey) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not configured');
  } else if (supabaseKey.length < 100) {
    warnings.push('Supabase key appears to be invalid (too short)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    supabaseUrl,
    supabaseKey
  };
}

/**
 * Get user-friendly error message for environment issues
 */
export function getEnvironmentErrorMessage(status: EnvironmentStatus): string {
  if (status.isValid) return '';
  
  const messages = [
    'Configuration Error:',
    ...status.errors.map(error => `• ${error}`),
    '',
    'Please check your environment configuration.'
  ];
  
  if (status.warnings.length > 0) {
    messages.push('', 'Warnings:', ...status.warnings.map(warning => `• ${warning}`));
  }
  
  return messages.join('\n');
}

/**
 * Check if we're in a valid environment for making API calls
 */
export function canMakeApiCalls(): boolean {
  return validateEnvironment().isValid;
}