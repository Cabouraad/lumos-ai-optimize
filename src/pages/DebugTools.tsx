import React from 'react';
import { BatchPromptRunner } from '@/components/BatchPromptRunner';
import { ProviderDebugPanel } from '@/components/ProviderDebugPanel';

export default function DebugTools() {
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