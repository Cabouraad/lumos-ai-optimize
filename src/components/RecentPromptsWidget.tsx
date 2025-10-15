import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Eye, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  
  Users,
  MapPin,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface RecentPrompt {
  id: string;
  text: string;
  runAt: string;
  provider: string;
  brandPresent: boolean;
  score: number;
  position: number | null;
  competitorsCount: number;
  sentiment: number;
  detectedBrands: string[];
  aiResponse: string;
}

interface RecentPromptsWidgetProps {
  prompts: RecentPrompt[];
  loading?: boolean;
}

export function RecentPromptsWidget({ prompts, loading }: RecentPromptsWidgetProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpanded = (promptId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(promptId)) {
      newExpanded.delete(promptId);
    } else {
      newExpanded.add(promptId);
    }
    setExpandedRows(newExpanded);
  };

  const getScorePillStyles = (score: number) => {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const formatPosition = (position: number | null) => {
    if (!position) return 'N/R';
    if (position === 1) return '1st';
    if (position === 2) return '2nd';
    if (position === 3) return '3rd';
    return `${position}th`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return { icon: '🤖', bgColor: 'bg-gray-100', textColor: 'text-gray-900' };
      case 'perplexity':
        return { icon: '🔍', bgColor: 'bg-blue-100', textColor: 'text-blue-900' };
      case 'gemini':
        return { icon: '✨', bgColor: 'bg-purple-100', textColor: 'text-purple-900' };
      default:
        return { icon: '🔗', bgColor: 'bg-gray-100', textColor: 'text-gray-900' };
    }
  };

  if (loading) {
    return (
      <Card className="shadow-soft rounded-2xl border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-accent" />
                Recent Prompts
              </CardTitle>
              <CardDescription>
                Latest prompt performance and provider coverage
              </CardDescription>
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 bg-muted/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!prompts || prompts.length === 0) {
    return (
      <Card className="shadow-soft rounded-2xl border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-accent" />
                Recent Prompts
              </CardTitle>
              <CardDescription>
                Latest prompt performance and provider coverage
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/prompts">View All Prompts</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No recent runs yet — try creating a prompt!
            </p>
            <Button asChild variant="default" size="sm">
              <Link to="/prompts">Create Your First Prompt</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft rounded-2xl border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              Recent Prompts
            </CardTitle>
            <CardDescription>
              Latest prompt performance and provider coverage
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/prompts">View All Prompts</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {prompts.slice(0, 5).map((prompt) => {
          const isExpanded = expandedRows.has(prompt.id);
          
          return (
            <div key={prompt.id} className="border border-border rounded-xl overflow-hidden">
              {/* Summary Row */}
              <div 
                className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => toggleExpanded(prompt.id)}
              >
                {/* Left Section - Prompt Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p 
                      className="font-medium text-sm truncate max-w-md" 
                      title={prompt.text}
                    >
                      {prompt.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(prompt.runAt), { addSuffix: true })}
                  </div>
                </div>

                {/* Middle Section - KPIs */}
                <div className="flex items-center gap-3 mx-6">
                  {/* Brand Present */}
                  <div className="text-center">
                    <div className={`text-lg ${prompt.brandPresent ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {prompt.brandPresent ? '✓' : '✗'}
                    </div>
                    <div className="text-xs text-muted-foreground">Brand</div>
                  </div>

                  {/* Score Pill */}
                  <Badge 
                    variant="outline" 
                    className={`px-2 py-1 text-xs font-semibold border ${getScorePillStyles(prompt.score)}`}
                  >
                    {(prompt.score * 10).toFixed(1)}%
                  </Badge>

                  {/* Position */}
                  <div className="text-center min-w-[40px]">
                    <div className="text-sm font-semibold text-foreground">
                      {formatPosition(prompt.position)}
                    </div>
                    <div className="text-xs text-muted-foreground">Pos</div>
                  </div>

                  {/* Competitors Count */}
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span className="text-sm font-semibold">{prompt.competitorsCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Comp</div>
                  </div>
                </div>

                {/* Right Section - Provider & Expand */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const providerConfig = getProviderIcon(prompt.provider);
                    return (
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold
                        ${providerConfig.bgColor} ${providerConfig.textColor}
                      `}>
                        {providerConfig.icon}
                      </div>
                    );
                  })()}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Details Panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-muted/20 p-4 space-y-4">
                      {/* AI Response Snippet */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">AI Response</h4>
                        <div className="bg-background rounded-lg p-3 border">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {prompt.aiResponse}
                          </p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 mt-2 text-xs"
                          >
                            View Full Response
                          </Button>
                        </div>
                      </div>

                      {/* Detected Brands */}
                      {prompt.detectedBrands.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Detected Brands</h4>
                          <div className="flex flex-wrap gap-2">
                            {prompt.detectedBrands.map((brand, index) => (
                              <Badge 
                                key={index}
                                variant="secondary"
                                className="rounded-full text-xs bg-slate-100 text-slate-700"
                              >
                                {brand}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sentiment Score */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Sentiment</h4>
                        <div className="flex items-center gap-2">
                          {prompt.sentiment > 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-rose-600" />
                          )}
                          <span className={`text-sm font-medium ${prompt.sentiment > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {prompt.sentiment > 0 ? '+' : ''}{prompt.sentiment}%
                          </span>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            View Full Run
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}