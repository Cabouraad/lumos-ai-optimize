import React from 'react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { DiagnosticPanel } from '@/components/DiagnosticPanel';

export function AdminDiagnosticPanel() {
  const { isAdmin } = useAdminAccess();

  if (!isAdmin) {
    return null;
  }

  return <DiagnosticPanel />;
}