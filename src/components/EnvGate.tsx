import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getPublicEnv } from '@/lib/env/browserEnv';
import { AlertTriangle } from 'lucide-react';
import { getSupabaseBootError } from '@/lib/supabase/browser';

export const EnvGate: React.FC = () => {
  // Only show info in development when using fallback config
  if (import.meta.env.PROD) {
    return null;
  }

  const { debugHealth } = getPublicEnv();
  const bootErr = getSupabaseBootError();
  
  if (!bootErr) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-4">
      <Alert className="border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          <strong>Development Environment:</strong> Using fallback Supabase configuration. 
          For custom settings, add <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> to your environment.
          {debugHealth && ' Check the console for more details.'}
        </AlertDescription>
      </Alert>
    </div>
  );
};