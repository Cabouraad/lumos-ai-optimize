/**
 * Component to display brand classification status and allow manual corrections
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBrandFeedbackCollector } from '@/lib/ml-enhancement/brand-learning';

interface BrandClassificationStatusProps {
  promptId: string;
  orgBrandPresent: boolean;
  competitors: string[];
  score: number;
  onUpdate?: () => void;
}

export function BrandClassificationStatus({ 
  promptId, 
  orgBrandPresent, 
  competitors, 
  score,
  onUpdate 
}: BrandClassificationStatusProps) {
  const [isFixing, setIsFixing] = useState(false);
  const { recordBrandFeedback } = useBrandFeedbackCollector();

  const handleFixClassification = async () => {
    setIsFixing(true);
    try {
      // Check if any competitors are actually org brands
      const suspiciousCompetitors = competitors.filter(comp => 
        ['hubspot', 'your company', 'our platform'].some(pattern => 
          comp.toLowerCase().includes(pattern)
        )
      );

      if (suspiciousCompetitors.length > 0) {
        const { error } = await supabase.rpc('fix_hubspot_brand_classification');
        if (error) throw error;
        
        toast.success(`Fixed classification for ${suspiciousCompetitors.length} misclassified brands`);
        onUpdate?.();
      } else {
        toast.info('No obvious misclassifications detected');
      }
    } catch (error) {
      console.error('Fix classification error:', error);
      toast.error('Failed to fix classification');
    } finally {
      setIsFixing(false);
    }
  };

  const handleBrandFeedback = (brandName: string, isCorrect: boolean) => {
    recordBrandFeedback(brandName, isCorrect, undefined, `Prompt: ${promptId}`);
    toast.success('Feedback recorded - this will improve future classifications');
  };

  const hasIssues = !orgBrandPresent && score < 3;
  const hasSuspiciousCompetitors = competitors.some(comp => 
    ['hubspot', 'your company', 'our platform', 'our service'].some(pattern => 
      comp.toLowerCase().includes(pattern)
    )
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Brand Classification Status</h4>
        {(hasIssues || hasSuspiciousCompetitors) && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleFixClassification}
            disabled={isFixing}
            className="text-xs"
          >
            {isFixing ? (
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {isFixing ? 'Fixing...' : 'Fix Classification'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {orgBrandPresent ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="font-medium">Your Brand</span>
          </div>
          <Badge variant={orgBrandPresent ? 'default' : 'secondary'}>
            {orgBrandPresent ? 'Found' : 'Not Found'}
          </Badge>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">Competitors</span>
            {hasSuspiciousCompetitors && (
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            )}
          </div>
          <Badge variant="outline">
            {competitors.length} detected
          </Badge>
        </div>
      </div>

      {hasSuspiciousCompetitors && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
            ⚠️ Suspicious competitors detected (may be your brand):
          </p>
          <div className="flex flex-wrap gap-1">
            {competitors
              .filter(comp => 
                ['hubspot', 'your company', 'our platform', 'our service'].some(pattern => 
                  comp.toLowerCase().includes(pattern)
                )
              )
              .map(comp => (
                <div key={comp} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {comp}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-red-500"
                    onClick={() => handleBrandFeedback(comp, false)}
                    title="Mark as incorrect"
                  >
                    ✗
                  </Button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {!orgBrandPresent && score < 3 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 Low score detected. Your brand might be misclassified as a competitor or not detected at all.
          </p>
        </div>
      )}
    </Card>
  );
}