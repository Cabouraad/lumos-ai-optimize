import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { useBrands, Brand } from '@/hooks/useBrands';
import { useBrand } from '@/contexts/BrandContext';
import { BrandDisplay } from '@/components/BrandDisplay';
import { Skeleton } from '@/components/ui/skeleton';

export default function Brands() {
  const navigate = useNavigate();
  const { brands, isLoading, createBrand, isCreating } = useBrands();
  const { setSelectedBrand } = useBrand();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDomain, setNewBrandDomain] = useState('');

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    navigate('/dashboard');
  };

  const handleCreateBrand = () => {
    if (!newBrandName.trim() || !newBrandDomain.trim()) return;
    
    createBrand(
      { name: newBrandName, domain: newBrandDomain },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setNewBrandName('');
          setNewBrandDomain('');
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Brands</h1>
          <p className="text-muted-foreground">Select a brand to view its dashboard</p>
        </div>

        {/* Search and Create */}
        <div className="flex gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Brand
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Brand</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input
                    id="brand-name"
                    placeholder="e.g., Apple"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-domain">Domain</Label>
                  <Input
                    id="brand-domain"
                    placeholder="e.g., apple.com"
                    value={newBrandDomain}
                    onChange={(e) => setNewBrandDomain(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateBrand}
                  disabled={!newBrandName.trim() || !newBrandDomain.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Brand'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Brand Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                  <div className="mt-6 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-10 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No brands found matching your search' : 'No brands yet'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                Create Your First Brand
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrands.map((brand) => (
              <Card
                key={brand.id}
                className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group"
                onClick={() => handleBrandSelect(brand)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <BrandDisplay brandName={brand.name} />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{brand.domain}</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Visibility Score</span>
                      <span className="text-sm font-medium">0.0%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: '0%' }}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full mt-6 group-hover:bg-primary/90"
                    onClick={() => handleBrandSelect(brand)}
                  >
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
