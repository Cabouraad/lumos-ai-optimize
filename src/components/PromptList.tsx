import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PromptRow } from './PromptRow';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
   
  Pause, 
  Trash2, 
  Plus,
  CheckCircle2,
  X,
  Loader2
} from 'lucide-react';
import { getPromptCategory } from '@/lib/prompt-utils';

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
  cluster_tag?: string | null;
}

interface PromptListProps {
  prompts: PromptWithStats[];
  providerData: any[];
  loading: boolean;
  onToggleActive: (promptId: string, active: boolean) => void;
  onDeletePrompt: (promptId: string) => void;
  onDeleteMultiple: (promptIds: string[]) => void;
  onEditPrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  onAddPrompt: () => void;
}

export function PromptList({
  prompts,
  providerData,
  loading,
  onToggleActive,
  onDeletePrompt,
  onDeleteMultiple,
  onEditPrompt,
  onDuplicatePrompt,
  onAddPrompt,
}: PromptListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter prompts based on search and filters
  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt => {
      // Search filter
      const searchMatch = prompt.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const statusMatch = filterStatus === 'all' || 
                         (filterStatus === 'active' && prompt.active) ||
                         (filterStatus === 'paused' && !prompt.active);
      
      // Category filter - use getPromptCategory function to determine category
      const categoryMatch = filterCategory === 'all' || (() => {
        const promptCategory = getPromptCategory(prompt.text);
        return promptCategory === filterCategory;
      })();

      return searchMatch && statusMatch && categoryMatch;
    });
  }, [prompts, searchQuery, filterStatus, filterCategory]);

  // Paginated prompts
  const paginatedPrompts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPrompts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPrompts, currentPage]);

  const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);

  // Update bulk actions visibility when selection changes
  useEffect(() => {
    setShowBulkActions(selectedPrompts.size > 0);
  }, [selectedPrompts]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedPrompts(new Set());
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterCategory]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPrompts(new Set(paginatedPrompts.map(p => p.id)));
    } else {
      setSelectedPrompts(new Set());
    }
  };

  const handleSelectPrompt = (promptId: string, checked: boolean) => {
    const newSelected = new Set(selectedPrompts);
    if (checked) {
      newSelected.add(promptId);
    } else {
      newSelected.delete(promptId);
    }
    setSelectedPrompts(newSelected);
  };


  const handleBulkEnable = async () => {
    const selectedIds = Array.from(selectedPrompts);
    try {
      await Promise.all(selectedIds.map(id => onToggleActive(id, true)));
      setSelectedPrompts(new Set());
    } finally {
      // Clean up completed
    }
  };

  const handleBulkDisable = async () => {
    const selectedIds = Array.from(selectedPrompts);
    try {
      await Promise.all(selectedIds.map(id => onToggleActive(id, false)));
      setSelectedPrompts(new Set());
    } finally {
      // Clean up completed
    }
  };


  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedPrompts);
    try {
      await onDeleteMultiple(selectedIds);
      setSelectedPrompts(new Set());
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const allSelected = paginatedPrompts.length > 0 && paginatedPrompts.every(p => selectedPrompts.has(p.id));
  const someSelected = paginatedPrompts.some(p => selectedPrompts.has(p.id));

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-soft border border-border/50 p-4">
          <Skeleton className="h-10 w-full" />
        </div>
        
        {/* Row skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-soft border border-border/50 p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header Toolbar */}
      <div className="sticky top-0 z-20 bg-gradient-subtle/80 backdrop-blur-sm border-b border-border/30 py-4">
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-soft border border-border/50 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 transition-smooth"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-32 h-10 bg-background/50 border-border/50 hover:border-primary/50 transition-smooth">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card/95 backdrop-blur-sm border-border/50">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full sm:w-44 h-10 bg-background/50 border-border/50 hover:border-primary/50 transition-smooth">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card/95 backdrop-blur-sm border-border/50">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Brand Visibility">Brand Visibility</SelectItem>
                    <SelectItem value="Competitor Monitoring">Competitor Monitoring</SelectItem>
                    <SelectItem value="Content Optimization">Content Optimization</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={onAddPrompt} className="h-10 hover-lift shadow-glow transition-smooth">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Prompt
                </Button>
              </div>
            </div>

            {/* Results summary */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Showing {paginatedPrompts.length} of {filteredPrompts.length} prompts
                  {filteredPrompts.length !== prompts.length && ` (filtered from ${prompts.length})`}
                </span>
                {selectedPrompts.size > 0 && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {selectedPrompts.size} selected
                  </Badge>
                )}
              </div>

              {/* Master checkbox */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Select all</span>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  {...(someSelected && !allSelected ? { 'data-state': 'indeterminate' } : {})}
                />
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {showBulkActions && (
            <div className="bg-primary/10 backdrop-blur-sm border border-primary/30 rounded-2xl p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium gradient-primary bg-clip-text text-transparent">
                    {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''} selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkEnable}
                    className="h-8 text-xs hover-lift border-border/50 hover:border-primary/50 transition-smooth"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Enable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDisable}
                    className="h-8 text-xs hover-lift border-border/50 hover:border-primary/50 transition-smooth"
                  >
                    <Pause className="mr-1 h-3 w-3" />
                    Disable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/50 transition-smooth"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPrompts(new Set())}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-smooth"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompts List */}
      <div className="space-y-2">
        {paginatedPrompts.length > 0 ? (
          <>
            {paginatedPrompts.map((prompt) => {
              const promptDetails = providerData.find(pd => pd.promptId === prompt.id);
              return (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  promptDetails={promptDetails}
                  onEdit={(p) => onEditPrompt(p.id)}
                  onToggleActive={onToggleActive}
                  onDeletePrompt={onDeletePrompt}
                  onDuplicatePrompt={onDuplicatePrompt}
                  isSelected={selectedPrompts.has(prompt.id)}
                  onSelect={(checked) => handleSelectPrompt(prompt.id, checked)}
                />
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 pb-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0 text-xs"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-soft border border-border/50 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold gradient-primary bg-clip-text text-transparent mb-2">
                {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'No prompts match your filters'
                  : 'No prompts yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                  : 'Get started by creating your first prompt to monitor brand visibility in AI search results.'}
              </p>
              {(!searchQuery && filterStatus === 'all' && filterCategory === 'all') && (
                <Button onClick={onAddPrompt} className="hover-lift shadow-glow transition-smooth">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Prompt
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl bg-card/95 backdrop-blur-sm border-border/50 shadow-elegant">
          <AlertDialogHeader>
            <AlertDialogTitle className="gradient-primary bg-clip-text text-transparent">Delete Selected Prompts</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''}? 
              This will also remove all associated visibility results and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50 hover:border-primary/50 transition-smooth">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-glow transition-smooth"
            >
              Delete {selectedPrompts.size} Prompt{selectedPrompts.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}