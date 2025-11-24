import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { StarterPromptsSelection } from '@/components/onboarding/StarterPromptsSelection';

export default function StarterPrompts() {
  const { orgData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!orgData?.id) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <StarterPromptsSelection 
      orgId={orgData.id} 
      orgName={orgData.organizations?.name || orgData.domain}
    />
  );
}
