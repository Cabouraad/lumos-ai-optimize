import React from 'react';
import { BatchPromptRunner } from '@/components/BatchPromptRunner';
import { ProviderDebugPanel } from '@/components/ProviderDebugPanel';
import { DomainResolverDiagnostics } from '@/components/admin/DomainResolverDiagnostics';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2 } from 'lucide-react';

export default function DebugTools() {
  const { isAdmin, isLoading } = useAdminAccess();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Checking access...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
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
      
      {/* Domain Resolver Diagnostics */}
      <div className="border-t pt-6">
        <h2 className="text-2xl font-semibold mb-4">Domain Resolver Diagnostics</h2>
        <DomainResolverDiagnostics />
      </div>
    </div>
  );
}