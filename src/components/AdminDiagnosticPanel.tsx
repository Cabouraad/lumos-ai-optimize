import React from 'react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { DiagnosticPanel } from '@/components/DiagnosticPanel';

export function AdminDiagnosticPanel() {
  const { isAdmin, isLoading } = useAdminAccess();

  // Don't render anything while auth is loading to prevent context errors
  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  return <DiagnosticPanel />;
}