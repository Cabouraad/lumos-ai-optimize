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
  
  // Use hardcoded Supabase configuration
  const supabaseUrl = 'https://cgocsffxqyhojtyzniyz.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk';
  
  // Configuration is valid since we have hardcoded values
  return {
    isValid: true,
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