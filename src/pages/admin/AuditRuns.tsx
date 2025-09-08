import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { ChevronDown, ChevronRight, Play, Download, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AuditRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: string; // Allow any string from database
  corr_id: string;
  summary?: any;
  details?: any;
  artifact_url?: string | null;
  created_by: string;
}

interface AuditEvent {
  id: number;
  run_id: string;
  ts: string;
  phase?: string;
  name?: string;
  level?: string;
  data?: any;
}

export default function AuditRuns() {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [events, setEvents] = useState<Record<string, AuditEvent[]>>({});
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAuditRuns();
  }, []);

  const loadAuditRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setRuns(data || []);
    } catch (error) {
      console.error('Failed to load audit runs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit runs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (runId: string) => {
    if (events[runId]) return; // Already loaded

    try {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('run_id', runId)
        .order('ts', { ascending: true });

      if (error) throw error;
      setEvents(prev => ({ ...prev, [runId]: data || [] }));
    } catch (error) {
      console.error('Failed to load audit events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit events',
        variant: 'destructive',
      });
    }
  };

  const toggleExpanded = async (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
      await loadEvents(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const runAuditNow = async () => {
    setRunning(true);
    try {
      // Call the auto-audit function via edge function
      const { data, error } = await supabase.functions.invoke('auto-audit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_CRON_SECRET || 'test-secret'}`
        }
      });

      if (error) throw error;

      toast({
        title: 'Audit Started',
        description: `Audit run ${data.corr_id} has been started`,
      });

      // Refresh the list after a short delay
      setTimeout(loadAuditRuns, 2000);
    } catch (error) {
      console.error('Failed to start audit run:', error);
      toast({
        title: 'Error',
        description: 'Failed to start audit run',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const downloadJSON = (run: AuditRun) => {
    const data = {
      run,
      events: events[run.id] || []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${run.corr_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Passed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'running':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Running</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPhaseSummary = (run: AuditRun) => {
    if (!run.summary?.phases) return null;
    
    const phases = run.summary.phases;
    const passed = phases.filter((p: any) => p.success).length;
    const total = phases.length;
    
    return `${passed}/${total} phases`;
  };

  const getDuration = (run: AuditRun) => {
    if (!run.finished_at) return 'Running...';
    
    const start = new Date(run.started_at);
    const end = new Date(run.finished_at);
    const durationMs = end.getTime() - start.getTime();
    return `${Math.round(durationMs / 1000)}s`;
  };

  const getLevelBadge = (level?: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case 'warn':
        return <Badge variant="secondary" className="text-xs">Warn</Badge>;
      case 'info':
      default:
        return <Badge variant="outline" className="text-xs">Info</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Automated Audit Runs</h1>
            <p className="text-muted-foreground mt-2">
              View and manage automated end-to-end audit runs
            </p>
          </div>
          <Button onClick={runAuditNow} disabled={running}>
            <Play className="w-4 h-4 mr-2" />
            {running ? 'Running...' : 'Run Now'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Runs</CardTitle>
            <CardDescription>
              Last 30 audit runs ordered by start time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audit runs found. Click "Run Now" to start your first audit.
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <Collapsible
                    key={run.id}
                    open={expandedRuns.has(run.id)}
                    onOpenChange={() => toggleExpanded(run.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <div className="flex items-center space-x-4">
                          {expandedRuns.has(run.id) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{run.corr_id}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-muted-foreground">
                            {getDuration(run)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getPhaseSummary(run)}
                          </div>
                          {getStatusBadge(run.status)}
                          <div className="flex space-x-2">
                            {run.artifact_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(run.artifact_url, '_blank');
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Report
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadJSON(run);
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              JSON
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3">Event Timeline</h4>
                          {events[run.id] ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-24">Time</TableHead>
                                  <TableHead className="w-24">Phase</TableHead>
                                  <TableHead className="w-32">Event</TableHead>
                                  <TableHead className="w-16">Level</TableHead>
                                  <TableHead>Data</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {events[run.id].map((event) => (
                                  <TableRow key={event.id}>
                                    <TableCell className="text-xs">
                                      {new Date(event.ts).toLocaleTimeString()}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {event.phase || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {event.name || '-'}
                                    </TableCell>
                                    <TableCell>
                                      {getLevelBadge(event.level)}
                                    </TableCell>
                                    <TableCell>
                                      {event.data && (
                                        <pre className="text-xs bg-muted p-2 rounded max-w-md overflow-x-auto">
                                          {JSON.stringify(event.data, null, 2)}
                                        </pre>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              Loading events...
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}