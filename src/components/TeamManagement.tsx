import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthProvider';
import { useUser } from '@/contexts/UserProvider';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Trash2, Users, Crown, Shield, User as UserIcon } from 'lucide-react';
import { InviteUserDialog } from './InviteUserDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  metadata: { role?: string };
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState(false);
  
  const { user } = useAuth();
  const { userData } = useUser();
  const { limits } = useSubscriptionGate();
  const { toast } = useToast();

  const isOwner = userData?.role === 'owner';

  useEffect(() => {
    if (userData?.org_id) {
      fetchTeamData();
    }
  }, [userData?.org_id]);

  const fetchTeamData = async () => {
    if (!userData?.org_id) return;

    try {
      setLoading(true);

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .eq('org_id', userData.org_id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch pending invitations (metadata column will be added via migration)
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('domain_invitations')
        .select('id, email, status, expires_at')
        .eq('org_id', userData.org_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitationsError) throw invitationsError;
      // Map to add empty metadata for now
      setInvitations((invitationsData || []).map(inv => ({ ...inv, metadata: {} })));

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!removeUserId) return;

    try {
      setRemovingUser(true);

      const { data, error } = await supabase.functions.invoke('remove-user', {
        body: { userId: removeUserId },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'User removed from organization',
      });

      await fetchTeamData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove user',
        variant: 'destructive',
      });
    } finally {
      setRemovingUser(false);
      setRemoveUserId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('domain_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation cancelled',
      });

      await fetchTeamData();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      default:
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const currentCount = members.length;
  const userLimit = limits.maxUsers || 1;
  const canAddMore = currentCount < userLimit;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading team members...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with user count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {currentCount} / {userLimit} Team Member{userLimit !== 1 ? 's' : ''}
          </span>
        </div>
        {isOwner && (
          <Button
            onClick={() => setInviteDialogOpen(true)}
            disabled={!canAddMore}
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        )}
      </div>

      {!canAddMore && isOwner && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">
            You've reached your team member limit. Upgrade your plan to add more users.
          </p>
        </div>
      )}

      {/* Team members list */}
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 bg-card border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {getRoleIcon(member.role)}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {member.email}
                  {member.id === user?.id && (
                    <span className="text-xs text-muted-foreground ml-2">(You)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Member since {new Date(member.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(member.role)}>
                {member.role}
              </Badge>
              {isOwner && member.id !== user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoveUserId(member.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Invitations</h3>
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 bg-muted/30 border border-dashed rounded-lg"
            >
              <div>
                <p className="text-sm font-medium">{invitation.email}</p>
                <p className="text-xs text-muted-foreground">
                  Invited as {invitation.metadata?.role || 'member'} • Expires{' '}
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </p>
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelInvitation(invitation.id)}
                >
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={fetchTeamData}
        currentCount={currentCount}
        userLimit={userLimit}
      />

      {/* Remove user confirmation dialog */}
      <AlertDialog open={!!removeUserId} onOpenChange={() => setRemoveUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from your organization? They will lose access to all organization data and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              disabled={removingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingUser ? 'Removing...' : 'Remove User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
