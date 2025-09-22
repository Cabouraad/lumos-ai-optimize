/**
 * Production environment configuration
 * This file provides safe production defaults that avoid bundling sensitive data
 */

export const PRODUCTION_CONFIG = {
  supabase: {
    url: 'https://cgocsffxqyhojtyzniyz.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
  },
  features: {
    debugHealth: false,
    enableLogging: false
  }
} as const;

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return (import.meta as any)?.env?.PROD || !(import.meta as any)?.env?.DEV;
}