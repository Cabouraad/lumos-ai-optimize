import React from 'react';
import { BatchPromptRunner } from '@/components/BatchPromptRunner';
import { ProviderDebugPanel } from '@/components/ProviderDebugPanel';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

export default function DebugTools() {
  const { user } = useAuth();

  // Restrict access to only the admin email
  if (!user || user.email !== 'abouraa.chri@gmail.com') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Access denied. Debug tools are restricted to authorized administrators only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Debug Tools</h1>
        <p className="text-muted-foreground">
          Test and analyze prompt responses across all providers
        </p>
      </div>

      {/* Batch Prompt Runner */}
      <BatchPromptRunner />

      {/* Provider Debug Panel */}
      <ProviderDebugPanel />
    </div>
  );
}