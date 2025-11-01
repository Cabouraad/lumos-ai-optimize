import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentCount: number;
  userLimit: number;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
  currentCount,
  userLimit,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if at limit
    if (currentCount >= userLimit) {
      setError(`Your plan allows ${userLimit} user${userLimit > 1 ? 's' : ''}. Upgrade to add more.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: { email: email.toLowerCase().trim(), role },
      });

      if (inviteError) throw inviteError;

      if (data?.error) {
        if (data.upgradeRequired) {
          setError(data.error);
          return;
        }
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: `Invitation sent to ${email}`,
      });

      // Reset form and close dialog
      setEmail('');
      setRole('member');
      onOpenChange(false);
      onSuccess();

    } catch (error: any) {
      console.error('Error inviting user:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your organization.
            ({currentCount} / {userLimit} team members)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'member' | 'admin')}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'member' 
                ? 'Members can view and manage prompts and recommendations.'
                : 'Admins have additional permissions to manage team settings.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setEmail('');
              setRole('member');
              setError(null);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={loading || !email || currentCount >= userLimit}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
