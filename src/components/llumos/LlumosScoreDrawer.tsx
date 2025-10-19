import { LlumosScoreResponse } from '@/hooks/useLlumosScore';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, Award, BarChart, Link as LinkIcon, Users, Clock } from 'lucide-react';

interface LlumosScoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoreData: LlumosScoreResponse;
  promptId?: string;
}

const submetricDetails = {
  pr: {
    icon: Target,
    label: 'Presence Rate',
    description: 'How often your brand appears in AI responses',
    tip: 'Create more comprehensive content covering key topics in your space.',
  },
  pp: {
    icon: Award,
    label: 'Prominence Position',
    description: 'Average position when your brand is mentioned',
    tip: 'Focus on becoming the authoritative source through high-quality citations.',
  },
  cv: {
    icon: BarChart,
    label: 'Coverage Variance',
    description: 'Consistency of presence across different prompts',
    tip: 'Ensure comprehensive coverage across all relevant topics and use cases.',
  },
  ca: {
    icon: LinkIcon,
    label: 'Citation Authority',
    description: 'Quality and authority of sources citing your brand',
    tip: 'Build relationships with authoritative sites and earn quality backlinks.',
  },
  cs: {
    icon: Users,
    label: 'Competitive Share',
    description: 'Your mention share vs. competitors',
    tip: 'Differentiate your content and establish unique thought leadership.',
  },
  fc: {
    icon: Clock,
    label: 'Freshness & Consistency',
    description: 'Recency and frequency of mentions',
    tip: 'Maintain regular content updates and consistent brand presence.',
  },
};

export function LlumosScoreDrawer({ 
  open, 
  onOpenChange, 
  scoreData,
  promptId,
}: LlumosScoreDrawerProps) {
  const windowStart = new Date(scoreData.window.start).toLocaleDateString();
  const windowEnd = new Date(scoreData.window.end).toLocaleDateString();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            {promptId ? 'Prompt Llumos Score' : 'Llumos Score Breakdown'}
            <Badge variant="secondary">{scoreData.tier}</Badge>
          </DrawerTitle>
          <DrawerDescription>
            AI visibility score for {windowStart} - {windowEnd}
            {scoreData.totalResponses && ` • ${scoreData.totalResponses} responses analyzed`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto">
          {/* Score Summary */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Overall Score</div>
                <div className="text-4xl font-bold">{scoreData.score}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Composite</div>
                <div className="text-2xl font-semibold">{scoreData.composite.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Insufficient Data Warning */}
          {scoreData.reason === 'insufficient_data' && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This score is based on limited data. 
                  Add more prompts and run them regularly for a more accurate score.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submetrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Score Pillars</h3>
            
            {Object.entries(scoreData.submetrics).map(([key, value]) => {
              const detail = submetricDetails[key as keyof typeof submetricDetails];
              const Icon = detail.icon;
              
              return (
                <Card key={key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{detail.label}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {detail.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-base font-semibold">
                        {value.toFixed(0)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={value} className="h-2" />
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                      <strong>Tip:</strong> {detail.tip}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Score Range Reference */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Score Tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Excellent</span>
                <Badge className="bg-emerald-600">760 - 900</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Very Good</span>
                <Badge className="bg-green-600">700 - 759</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Good</span>
                <Badge className="bg-yellow-600">640 - 699</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Fair</span>
                <Badge className="bg-amber-600">580 - 639</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Needs Improvement</span>
                <Badge className="bg-rose-600">300 - 579</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
