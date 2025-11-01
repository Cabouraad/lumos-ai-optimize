import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit2, Search, Upload, Trash2, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';

interface DomainAuthority {
  id: string;
  domain: string;
  authority_score: number;
  tier: string;
  category: string | null;
  notes: string | null;
  created_at: string;
  last_updated: string;
}

const TIERS = [
  { value: 'tier-1', label: 'Tier 1 (90-100)', description: 'Premium sources' },
  { value: 'tier-2', label: 'Tier 2 (70-89)', description: 'High authority' },
  { value: 'tier-3', label: 'Tier 3 (50-69)', description: 'Moderate authority' },
  { value: 'tier-4', label: 'Tier 4 (0-49)', description: 'Low authority' },
];

export default function DomainAuthority() {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [domains, setDomains] = useState<DomainAuthority[]>([]);
  const [filteredDomains, setFilteredDomains] = useState<DomainAuthority[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainAuthority | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    domain: '',
    authority_score: '',
    tier: 'tier-3',
    category: '',
    notes: '',
  });

  // Check permissions
  useEffect(() => {
    if (!isOwner) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
    }
  }, [isOwner, navigate]);

  // Fetch domains
  useEffect(() => {
    fetchDomains();
  }, []);

  // Filter domains
  useEffect(() => {
    let filtered = domains;
    
    if (searchQuery) {
      filtered = filtered.filter(d => 
        d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedTier !== 'all') {
      filtered = filtered.filter(d => d.tier === selectedTier);
    }
    
    setFilteredDomains(filtered);
  }, [domains, searchQuery, selectedTier]);

  const fetchDomains = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('domain_authority_reference')
        .select('*')
        .order('authority_score', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
      setFilteredDomains(data || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast.error('Failed to load domain authority data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const authorityScore = parseInt(formData.authority_score);
      if (isNaN(authorityScore) || authorityScore < 0 || authorityScore > 100) {
        toast.error('Authority score must be between 0 and 100');
        return;
      }

      const domainData = {
        domain: formData.domain.toLowerCase().trim(),
        authority_score: authorityScore,
        tier: formData.tier,
        category: formData.category || null,
        notes: formData.notes || null,
      };

      if (editingDomain) {
        // Update existing
        const { error } = await supabase
          .from('domain_authority_reference')
          .update({ ...domainData, last_updated: new Date().toISOString() })
          .eq('id', editingDomain.id);

        if (error) throw error;
        toast.success('Domain updated successfully');
      } else {
        // Insert new
        const { error } = await supabase
          .from('domain_authority_reference')
          .insert(domainData);

        if (error) throw error;
        toast.success('Domain added successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDomains();
    } catch (error: any) {
      console.error('Error saving domain:', error);
      toast.error(error.message || 'Failed to save domain');
    }
  };

  const handleEdit = (domain: DomainAuthority) => {
    setEditingDomain(domain);
    setFormData({
      domain: domain.domain,
      authority_score: domain.authority_score.toString(),
      tier: domain.tier,
      category: domain.category || '',
      notes: domain.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
      const { error } = await supabase
        .from('domain_authority_reference')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Domain deleted successfully');
      fetchDomains();
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast.error('Failed to delete domain');
    }
  };

  const resetForm = () => {
    setFormData({
      domain: '',
      authority_score: '',
      tier: 'tier-3',
      category: '',
      notes: '',
    });
    setEditingDomain(null);
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier-1': return 'bg-emerald-600';
      case 'tier-2': return 'bg-green-600';
      case 'tier-3': return 'bg-yellow-600';
      case 'tier-4': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Domain Authority Management</h1>
          </div>
          <p className="text-muted-foreground">
            Manage citation authority reference data for Llumos Score calculations
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Domain Authority Reference</CardTitle>
                <CardDescription>
                  {domains.length} domain{domains.length !== 1 ? 's' : ''} in database
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingDomain ? 'Edit Domain' : 'Add New Domain'}
                    </DialogTitle>
                    <DialogDescription>
                      Enter domain information and authority score
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="domain">Domain</Label>
                        <Input
                          id="domain"
                          placeholder="example.com"
                          value={formData.domain}
                          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="authority_score">Authority Score (0-100)</Label>
                        <Input
                          id="authority_score"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="85"
                          value={formData.authority_score}
                          onChange={(e) => setFormData({ ...formData, authority_score: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tier">Tier</Label>
                        <Select value={formData.tier} onValueChange={(value) => setFormData({ ...formData, tier: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIERS.map(tier => (
                              <SelectItem key={tier.value} value={tier.value}>
                                {tier.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="category">Category (Optional)</Label>
                        <Input
                          id="category"
                          placeholder="Technology, News, Education..."
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Input
                          id="notes"
                          placeholder="Additional information"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingDomain ? 'Update' : 'Add'} Domain
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {TIERS.map(tier => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDomains.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No domains found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell className="font-medium">{domain.domain}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{domain.authority_score}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTierBadgeColor(domain.tier)}>
                              {domain.tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {domain.category || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(domain.last_updated).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(domain)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(domain.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Import
            </CardTitle>
            <CardDescription>
              Import multiple domains from CSV (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bulk import functionality will allow you to upload a CSV file with domain authority data.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
