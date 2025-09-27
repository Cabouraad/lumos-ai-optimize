import { useUser } from '@/contexts/UserProvider';

export function usePermissions() {
  const { userData } = useUser();

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