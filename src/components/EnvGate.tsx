import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EnvGate: React.FC = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    return null;
  }

  return (
    <Alert className="mx-4 mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        Backend not configured for this environment. Some features may not work properly.
      </AlertDescription>
    </Alert>
  );
};