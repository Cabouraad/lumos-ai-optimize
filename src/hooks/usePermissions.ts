import { useUser } from '@/contexts/UnifiedAuthProvider';

export function usePermissions() {
  const { userData } = useUser();

  // Role comes from user_roles table via UserProvider
  const isOwner = userData?.role === 'owner';
  const isMember = userData?.role === 'member' || isOwner;
  const hasOrgAccess = !!userData?.org_id;

  return {
    isOwner,
    isMember,
    hasOrgAccess,
    role: userData?.role || null,
    orgId: userData?.org_id || null,
  };
}