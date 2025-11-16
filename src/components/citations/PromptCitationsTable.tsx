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
  citationType: 'Content' | 'Social' | 'Owned';
  totalCitations: number;
  citationPercentage: number;
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
  const [sortBy, setSortBy] = useState<'citations'>('citations');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  useEffect(() => {
    if (!promptId || !orgData?.id) return;

    const fetchCitations = async () => {
      try {
        setLoading(true);

        // Fetch 30 days of rolling history for citations
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch all responses for this prompt with citations in last 30 days
        const { data: responses, error } = await supabase
          .from('prompt_provider_responses')
          .select('citations_json, org_brand_present, provider, org_id, run_at')
          .eq('prompt_id', promptId)
          .gte('run_at', thirtyDaysAgo.toISOString())
          .not('citations_json', 'is', null)
          .order('run_at', { ascending: false });

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
          isOrgDomain: boolean;
          isSocial: boolean;
        }>();

        let totalCitationCount = 0;

        // Common social media domains
        const socialDomains = new Set([
          'twitter.com', 'x.com', 'facebook.com', 'linkedin.com', 'instagram.com',
          'youtube.com', 'tiktok.com', 'reddit.com', 'pinterest.com', 'snapchat.com'
        ]);

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

            totalCitationCount++;

            const existing = citationMap.get(url);
            if (existing) {
              existing.totalCount++;
            } else {
              const isOrgDomain = orgDomains.has(domain.toLowerCase());
              const isSocial = socialDomains.has(domain.toLowerCase());
              
              citationMap.set(url, {
                url,
                title: citation.title || null,
                domain,
                totalCount: 1,
                isOrgDomain,
                isSocial
              });
            }
          });
        });

        // Convert to CitationData array
        const citationData: CitationData[] = Array.from(citationMap.values()).map(item => {
          const citationPercentage = totalCitationCount > 0 
            ? (item.totalCount / totalCitationCount) * 100 
            : 0;

          // Determine citation type: Owned > Social > Content
          let citationType: CitationData['citationType'];
          if (item.isOrgDomain) {
            citationType = 'Owned';
          } else if (item.isSocial) {
            citationType = 'Social';
          } else {
            citationType = 'Content';
          }

          return {
            url: item.url,
            title: item.title,
            domain: item.domain,
            citationType,
            totalCitations: item.totalCount,
            citationPercentage
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
      return sortOrder === 'desc' ? b.totalCitations - a.totalCitations : a.totalCitations - b.totalCitations;
    });

    return filtered;
  }, [citations, searchTerm, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCitations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCitations = filteredAndSortedCitations.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const handleExport = () => {
    const csv = [
      ['Page', 'Citation Type', 'Citations'],
      ...filteredAndSortedCitations.map(c => [
        c.url,
        c.citationType,
        c.totalCitations.toString()
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
              <TableHead className="w-[50%]">
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
                        <p>Owned = your domain | Social = social media | Content = other content</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="w-[30%]">
                <button
                  onClick={handleSort}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Citations
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
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
                      <span className="truncate max-w-[500px]">
                        {citation.url}
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
                      {citation.citationType === 'Social' && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
                          Social
                        </Badge>
                      )}
                      {citation.citationType === 'Content' && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                          Content
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
                      <div className="flex-1 max-w-[180px]">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${(citation.totalCitations / maxCitations) * 100}%` }}
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
