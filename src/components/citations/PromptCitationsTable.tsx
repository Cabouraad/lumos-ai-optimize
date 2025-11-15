import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Search,
  Download,
  ArrowUpDown,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CitationData {
  url: string;
  title: string | null;
  domain: string;
  citationType: 'Owned' | 'Earned' | 'Competitor Earned' | 'Competitor Owned';
  totalCitations: number;
  brandCitations: number;
  citationPercentage: number;
  brandCitationPercentage: number;
}

interface PromptCitationsTableProps {
  promptId: string;
}

export function PromptCitationsTable({ promptId }: PromptCitationsTableProps) {
  const { orgData } = useAuth();
  const [citations, setCitations] = useState<CitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'citations' | 'brandCitations'>('citations');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  useEffect(() => {
    if (!promptId || !orgData?.id) return;

    const fetchCitations = async () => {
      try {
        setLoading(true);

        // Fetch all responses for this prompt with citations
        const { data: responses, error } = await supabase
          .from('prompt_provider_responses')
          .select('citations_json, org_brand_present, provider, org_id')
          .eq('prompt_id', promptId)
          .not('citations_json', 'is', null)
          .order('run_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Get org domains to identify owned vs earned
        const { data: brands } = await supabase
          .from('brands')
          .select('domain')
          .eq('org_id', orgData.id);

        const orgDomains = new Set(brands?.map(b => b.domain.toLowerCase()) || []);

        // Aggregate citations by URL
        const citationMap = new Map<string, {
          url: string;
          title: string | null;
          domain: string;
          totalCount: number;
          brandMentionCount: number;
          isOrgDomain: boolean;
          isCompetitorDomain: boolean;
        }>();

        let totalCitationCount = 0;
        let totalBrandCitationCount = 0;

        responses?.forEach(response => {
          let citations: any[] = [];
          
          if (response.citations_json) {
            const citationsData = response.citations_json as any;
            if (Array.isArray(citationsData)) {
              citations = citationsData;
            } else if (citationsData.citations && Array.isArray(citationsData.citations)) {
              citations = citationsData.citations;
            }
          }

          citations.forEach(citation => {
            const url = citation.url || '';
            const domain = citation.domain || new URL(url).hostname;
            const hasBrandMention = citation.brand_mention === 'yes' || 
                                   citation.resolved_brand?.type === 'known';

            totalCitationCount++;
            if (hasBrandMention) totalBrandCitationCount++;

            const existing = citationMap.get(url);
            if (existing) {
              existing.totalCount++;
              if (hasBrandMention) existing.brandMentionCount++;
            } else {
              const isOrgDomain = orgDomains.has(domain.toLowerCase());
              citationMap.set(url, {
                url,
                title: citation.title || null,
                domain,
                totalCount: 1,
                brandMentionCount: hasBrandMention ? 1 : 0,
                isOrgDomain,
                isCompetitorDomain: false // Will be determined by checking if it's not org domain but has brand mentions
              });
            }
          });
        });

        // Convert to CitationData array
        const citationData: CitationData[] = Array.from(citationMap.values()).map(item => {
          const citationPercentage = totalCitationCount > 0 
            ? (item.totalCount / totalCitationCount) * 100 
            : 0;
          const brandCitationPercentage = totalBrandCitationCount > 0
            ? (item.brandMentionCount / totalBrandCitationCount) * 100
            : 0;

          // Determine citation type
          let citationType: CitationData['citationType'];
          if (item.isOrgDomain) {
            citationType = item.brandMentionCount > 0 ? 'Owned' : 'Owned';
          } else if (item.brandMentionCount > 0) {
            citationType = 'Earned';
          } else {
            citationType = 'Competitor Earned';
          }

          return {
            url: item.url,
            title: item.title,
            domain: item.domain,
            citationType,
            totalCitations: item.totalCount,
            brandCitations: item.brandMentionCount,
            citationPercentage,
            brandCitationPercentage
          };
        });

        setCitations(citationData);
      } catch (error) {
        console.error('Error fetching citations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCitations();
  }, [promptId, orgData?.id]);

  // Filter and sort citations
  const filteredAndSortedCitations = useMemo(() => {
    let filtered = citations.filter(citation => 
      citation.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      citation.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (citation.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    filtered.sort((a, b) => {
      const aVal = sortBy === 'citations' ? a.totalCitations : a.brandCitations;
      const bVal = sortBy === 'citations' ? b.totalCitations : b.brandCitations;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [citations, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCitations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCitations = filteredAndSortedCitations.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (column: 'citations' | 'brandCitations') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleExport = () => {
    const csv = [
      ['Page', 'Citation Type', 'Citations', 'Brand Citations'],
      ...filteredAndSortedCitations.map(c => [
        c.url,
        c.citationType,
        c.totalCitations.toString(),
        c.brandCitations.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citations-${promptId}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const maxCitations = Math.max(...citations.map(c => c.totalCitations), 1);
  const maxBrandCitations = Math.max(...citations.map(c => c.brandCitations), 1);

  return (
    <div className="space-y-4">
      {/* Header with search and export */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">
                <div className="flex items-center gap-2">
                  Page
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pages that cite or reference this prompt in AI responses</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="w-[20%]">
                <div className="flex items-center gap-2">
                  Citation Type
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Owned = your domain | Earned = external mention</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="w-[22.5%]">
                <button
                  onClick={() => handleSort('citations')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Citations
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
              <TableHead className="w-[22.5%]">
                <button
                  onClick={() => handleSort('brandCitations')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Brand Citations
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No citations found
                </TableCell>
              </TableRow>
            ) : (
              paginatedCitations.map((citation, index) => (
                <TableRow key={`${citation.url}-${index}`}>
                  <TableCell>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm flex items-center gap-1 group"
                    >
                      <span className="truncate max-w-[400px]">
                        {citation.title || citation.url}
                      </span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {citation.citationType === 'Owned' && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                          Owned
                        </Badge>
                      )}
                      {citation.citationType === 'Earned' && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                          Earned
                        </Badge>
                      )}
                      {citation.citationType === 'Competitor Earned' && (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                          Competitor Earned
                        </Badge>
                      )}
                      {citation.citationType === 'Competitor Owned' && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                          Competitor Owned
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium min-w-[2rem]">
                        {citation.totalCitations}
                      </span>
                      <span className="text-xs text-muted-foreground min-w-[3rem]">
                        {citation.citationPercentage.toFixed(1)}%
                      </span>
                      <div className="flex-1 max-w-[120px]">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${(citation.totalCitations / maxCitations) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium min-w-[2rem]">
                        {citation.brandCitations}
                      </span>
                      <span className="text-xs text-muted-foreground min-w-[3rem]">
                        {citation.brandCitationPercentage.toFixed(1)}%
                      </span>
                      <div className="flex-1 max-w-[120px]">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-warning transition-all duration-300"
                            style={{ width: `${(citation.brandCitations / maxBrandCitations) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAndSortedCitations.length)} of {filteredAndSortedCitations.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
