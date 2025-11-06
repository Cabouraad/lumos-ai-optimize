import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Merge, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Competitor {
  id: string;
  name: string;
  total_appearances: number;
  average_score: number;
  first_detected_at: string;
  last_seen_at: string;
  variants_json: string[];
  org_id: string;
}

interface DuplicateGroup {
  competitors: Competitor[];
  similarity: number;
}

export default function CompetitorManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [competitorToDelete, setCompetitorToDelete] = useState<string | null>(null);

  // Fetch current user's org_id
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();
      
      return profile;
    },
  });

  const orgId = userData?.org_id;

  // Fetch competitors
  const { data: competitors = [], isLoading, refetch } = useQuery({
    queryKey: ["competitors-management", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from("brand_catalog")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_org_brand", false)
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      return data as Competitor[];
    },
    enabled: !!orgId,
  });

  // Delete competitor mutation
  const deleteCompetitor = useMutation({
    mutationFn: async (competitorId: string) => {
      const { error } = await supabase
        .from("brand_catalog")
        .delete()
        .eq("id", competitorId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Competitor deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["competitors-management"] });
      setCompetitorToDelete(null);
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete competitor: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Merge competitors mutation
  const mergeCompetitors = useMutation({
    mutationFn: async (competitorIds: string[]) => {
      if (competitorIds.length < 2) {
        throw new Error("Select at least 2 competitors to merge");
      }

      const competitorsToMerge = competitors.filter(c => competitorIds.includes(c.id));
      
      // Primary competitor (most appearances)
      const primary = competitorsToMerge.reduce((prev, current) => 
        (current.total_appearances > prev.total_appearances) ? current : prev
      );

      // Combine all variants
      const allVariants = new Set<string>();
      competitorsToMerge.forEach(c => {
        allVariants.add(c.name);
        c.variants_json?.forEach(v => allVariants.add(v));
      });
      allVariants.delete(primary.name); // Don't include primary name in variants

      // Calculate combined stats
      const totalAppearances = competitorsToMerge.reduce((sum, c) => sum + c.total_appearances, 0);
      const avgScore = competitorsToMerge.reduce((sum, c) => sum + (c.average_score * c.total_appearances), 0) / totalAppearances;
      const earliestDetection = competitorsToMerge.reduce((earliest, c) => 
        new Date(c.first_detected_at) < new Date(earliest) ? c.first_detected_at : earliest
      , competitorsToMerge[0].first_detected_at);
      const latestSeen = competitorsToMerge.reduce((latest, c) => 
        new Date(c.last_seen_at) > new Date(latest) ? c.last_seen_at : latest
      , competitorsToMerge[0].last_seen_at);

      // Update primary competitor
      const { error: updateError } = await supabase
        .from("brand_catalog")
        .update({
          variants_json: Array.from(allVariants),
          total_appearances: totalAppearances,
          average_score: avgScore,
          first_detected_at: earliestDetection,
          last_seen_at: latestSeen,
        })
        .eq("id", primary.id);

      if (updateError) throw updateError;

      // Delete other competitors
      const othersToDelete = competitorIds.filter(id => id !== primary.id);
      if (othersToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("brand_catalog")
          .delete()
          .in("id", othersToDelete);

        if (deleteError) throw deleteError;
      }

      return { primary: primary.name, merged: othersToDelete.length };
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: `Merged ${result.merged} competitors into "${result.primary}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["competitors-management"] });
      setSelectedCompetitors(new Set());
      setMergeDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to merge competitors: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Detect potential duplicates
  const detectDuplicates = (competitors: Competitor[]): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    competitors.forEach(comp1 => {
      if (processed.has(comp1.id)) return;

      const similar: Competitor[] = [comp1];
      const name1Lower = comp1.name.toLowerCase().trim();

      competitors.forEach(comp2 => {
        if (comp1.id === comp2.id || processed.has(comp2.id)) return;

        const name2Lower = comp2.name.toLowerCase().trim();
        
        // Check for exact match, partial match, or Levenshtein similarity
        const similarity = calculateSimilarity(name1Lower, name2Lower);
        
        if (similarity > 0.7) {
          similar.push(comp2);
          processed.add(comp2.id);
        }
      });

      if (similar.length > 1) {
        processed.add(comp1.id);
        groups.push({
          competitors: similar,
          similarity: 0.85, // Average similarity
        });
      }
    });

    return groups;
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity check
    if (str1 === str2) return 1;
    if (str1.includes(str2) || str2.includes(str1)) return 0.85;
    
    // Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = levenshteinDistance(str1, str2);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const filteredCompetitors = competitors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const duplicateGroups = detectDuplicates(filteredCompetitors);

  const handleSelectCompetitor = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedCompetitors);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedCompetitors(newSelection);
  };

  const handleDeleteClick = (id: string) => {
    setCompetitorToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleMergeClick = () => {
    if (selectedCompetitors.size < 2) {
      toast({
        title: "Invalid selection",
        description: "Please select at least 2 competitors to merge",
        variant: "destructive",
      });
      return;
    }
    setMergeDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Competitor Management</h1>
          <p className="text-muted-foreground mt-1">
            Review, merge duplicates, and manage your tracked competitors ({competitors.length}/50)
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Duplicate Detection Alert */}
      {duplicateGroups.length > 0 && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning">Potential Duplicates Detected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Found {duplicateGroups.length} group(s) of similar competitors. Review and merge them below.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competitors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={handleMergeClick}
          disabled={selectedCompetitors.size < 2}
          variant="outline"
        >
          <Merge className="h-4 w-4 mr-2" />
          Merge Selected ({selectedCompetitors.size})
        </Button>
      </div>

      {/* Competitors Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Competitor</TableHead>
              <TableHead>Appearances</TableHead>
              <TableHead>Avg Score</TableHead>
              <TableHead>First Seen</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompetitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No competitors found
                </TableCell>
              </TableRow>
            ) : (
              filteredCompetitors.map((competitor) => {
                const isDuplicate = duplicateGroups.some(group =>
                  group.competitors.some(c => c.id === competitor.id)
                );

                return (
                  <TableRow key={competitor.id} className={isDuplicate ? "bg-warning/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedCompetitors.has(competitor.id)}
                        onCheckedChange={(checked) =>
                          handleSelectCompetitor(competitor.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {competitor.name}
                          {isDuplicate && (
                            <Badge variant="outline" className="text-warning border-warning">
                              Duplicate?
                            </Badge>
                          )}
                        </div>
                        {competitor.variants_json && competitor.variants_json.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Variants: {competitor.variants_json.join(", ")}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{competitor.total_appearances}</TableCell>
                    <TableCell>{competitor.average_score.toFixed(1)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(competitor.first_detected_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(competitor.last_seen_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(competitor.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this competitor? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => competitorToDelete && deleteCompetitor.mutate(competitorToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Competitors</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge {selectedCompetitors.size} competitors into one. The competitor with the most
              appearances will be kept, and all stats will be combined. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mergeCompetitors.mutate(Array.from(selectedCompetitors))}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
