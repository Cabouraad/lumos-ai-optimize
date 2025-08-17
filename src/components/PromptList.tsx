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
  Play, 
  Pause, 
  Trash2, 
  Plus,
  CheckCircle2,
  X,
  Loader2
} from 'lucide-react';

interface PromptData {
  id: string;
  text: string;
  createdAt: string;
  category: string;
  providers: Array<{ name: string; enabled: boolean; lastRun?: string }>;
  lastRunAt?: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  sentimentDelta: number;
  active: boolean;
}

interface PromptListProps {
  prompts: PromptData[];
  loading: boolean;
  onToggleActive: (promptId: string, active: boolean) => void;
  onDeletePrompt: (promptId: string) => void;
  onDeleteMultiple: (promptIds: string[]) => void;
  onEditPrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  onAddPrompt: () => void;
  runningPrompts: Set<string>;
}

export function PromptList({
  prompts,
  loading,
  onToggleActive,
  onDeletePrompt,
  onDeleteMultiple,
  onEditPrompt,
  onDuplicatePrompt,
  onAddPrompt,
  runningPrompts
}: PromptListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRunningBulk, setIsRunningBulk] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter prompts based on search and filters
  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt => {
      // Search filter
      const searchMatch = prompt.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Provider filter
      const providerMatch = filterProvider === 'all' || 
                           prompt.providers.some(p => p.name.toLowerCase() === filterProvider.toLowerCase() && p.enabled);
      
      // Status filter
      const statusMatch = filterStatus === 'all' || 
                         (filterStatus === 'active' && prompt.active) ||
                         (filterStatus === 'paused' && !prompt.active);
      
      // Category filter
      const categoryMatch = filterCategory === 'all' || prompt.category === filterCategory;

      return searchMatch && providerMatch && statusMatch && categoryMatch;
    });
  }, [prompts, searchQuery, filterProvider, filterStatus, filterCategory]);

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
  }, [searchQuery, filterProvider, filterStatus, filterCategory]);

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

  const handleToggleExpand = (promptId: string) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(promptId)) {
      newExpanded.delete(promptId);
    } else {
      newExpanded.add(promptId);
    }
    setExpandedPrompts(newExpanded);
  };

  const handleBulkEnable = async () => {
    const selectedIds = Array.from(selectedPrompts);
    setIsRunningBulk(true);
    try {
      await Promise.all(selectedIds.map(id => onToggleActive(id, true)));
      setSelectedPrompts(new Set());
    } finally {
      setIsRunningBulk(false);
    }
  };

  const handleBulkDisable = async () => {
    const selectedIds = Array.from(selectedPrompts);
    setIsRunningBulk(true);
    try {
      await Promise.all(selectedIds.map(id => onToggleActive(id, false)));
      setSelectedPrompts(new Set());
    } finally {
      setIsRunningBulk(false);
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
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
          <Skeleton className="h-10 w-full" />
        </div>
        
        {/* Row skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header Toolbar */}
      <div className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100 py-4">
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-gray-50 border-gray-200 focus:border-primary"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                  <SelectTrigger className="w-36 h-10 bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="perplexity">Perplexity</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32 h-10 bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-44 h-10 bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Brand Visibility">Brand Visibility</SelectItem>
                    <SelectItem value="Competitor Monitoring">Competitor Monitoring</SelectItem>
                    <SelectItem value="Content Optimization">Content Optimization</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={onAddPrompt} className="h-10 bg-primary hover:bg-primary-hover">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Prompt
                </Button>
              </div>
            </div>

            {/* Results summary */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4 text-sm text-gray-600">
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
                <span className="text-sm text-gray-600">Select all</span>
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
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''} selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkEnable}
                    disabled={isRunningBulk}
                    className="h-8 text-xs"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Enable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDisable}
                    disabled={isRunningBulk}
                    className="h-8 text-xs"
                  >
                    <Pause className="mr-1 h-3 w-3" />
                    Disable
                  </Button>
                  <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/50 rounded-lg">
                    Runs automatically at 3:00 AM ET
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isRunningBulk}
                    className="h-8 text-xs text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPrompts(new Set())}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
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
            {paginatedPrompts.map((prompt) => (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                isSelected={selectedPrompts.has(prompt.id)}
                isExpanded={expandedPrompts.has(prompt.id)}
                onSelect={(checked) => handleSelectPrompt(prompt.id, checked)}
                onExpand={() => handleToggleExpand(prompt.id)}
                onToggleActive={(active) => onToggleActive(prompt.id, active)}
                
                onEdit={() => onEditPrompt(prompt.id)}
                onDuplicate={() => onDuplicatePrompt(prompt.id)}
                onDelete={() => onDeletePrompt(prompt.id)}
                isRunning={runningPrompts.has(prompt.id)}
              />
            ))}

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
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || filterProvider !== 'all' || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'No prompts match your filters'
                  : 'No prompts yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterProvider !== 'all' || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                  : 'Get started by creating your first prompt to monitor brand visibility in AI search results.'}
              </p>
              {(!searchQuery && filterProvider === 'all' && filterStatus === 'all' && filterCategory === 'all') && (
                <Button onClick={onAddPrompt} className="bg-primary hover:bg-primary-hover">
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
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Prompts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''}? 
              This will also remove all associated visibility results and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {selectedPrompts.size} Prompt{selectedPrompts.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}