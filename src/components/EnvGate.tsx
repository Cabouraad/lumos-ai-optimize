import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getPublicEnv } from '@/lib/env/browserEnv';
import { AlertTriangle } from 'lucide-react';

export const EnvGate: React.FC = () => {
  // Only show warning in development when env vars are missing
  if (import.meta.env.PROD) {
    return null;
  }

  const { missing, debugHealth } = getPublicEnv();
  
  if (!missing) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-4">
      <Alert className="border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          <strong>Development Environment:</strong> Missing Supabase environment variables. 
          Create a <code className="bg-red-100 dark:bg-red-900 px-1 rounded">.env</code> file with your Supabase URL and anon key.
          {debugHealth && ' Check the console for more details.'}
        </AlertDescription>
      </Alert>
    </div>
  );
};