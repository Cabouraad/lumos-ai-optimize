/**
 * Component to manually fix classification issues in prompt responses
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateCache } from '@/lib/data/unified-fetcher';

interface ResponseClassificationFixerProps {
  responseId: string;
  provider: string;
  currentScore: number;
  brandPresent: boolean;
  competitorCount: number;
  competitors: string[];
  onFixed?: () => void;
}

export function ResponseClassificationFixer({ 
  responseId, 
  provider, 
  currentScore, 
  brandPresent, 
  competitorCount, 
  competitors,
  onFixed 
}: ResponseClassificationFixerProps) {
  const [isFixing, setIsFixing] = useState(false);

  // Detect if HubSpot is misclassified as competitor
  const hubspotAsCompetitor = competitors.some(comp => 
    /hubspot|marketing hub|hub.?spot/i.test(comp)
  );

  // Detect suspicious generic competitors
  const suspiciousCompetitors = competitors.filter(comp => 
    /^(seo|marketing|social media|facebook|adobe)$/i.test(comp.trim())
  );

  const needsFix = !brandPresent && (currentScore <= 2 || hubspotAsCompetitor || suspiciousCompetitors.length > 2);

  const handleFixResponse = async () => {
    setIsFixing(true);
    
    try {
      // Manual classification fix for this specific response
      const fixedCompetitors = competitors.filter(comp => 
        // Remove HubSpot variants and overly generic terms
        !/hubspot|marketing hub|hub.?spot|^seo$|^marketing$|^social media$/i.test(comp)
      );

      const hasHubSpotMention = hubspotAsCompetitor;
      
      // Calculate new score
      let newScore = currentScore;
      if (hasHubSpotMention) {
        newScore = Math.max(6.0, newScore + 4.0); // Brand found bonus
        newScore = Math.max(newScore - (fixedCompetitors.length * 0.3), 3.0); // Competition penalty
      } else if (suspiciousCompetitors.length > 0) {
        // Just remove noise competitors and adjust score slightly
        newScore = Math.min(newScore + 1.0, 7.0);
      }

      const { error } = await supabase
        .from('prompt_provider_responses')
        .update({
          org_brand_present: hasHubSpotMention || brandPresent,
          org_brand_prominence: hasHubSpotMention ? 1 : null,
          competitors_json: JSON.stringify(fixedCompetitors),
          competitors_count: fixedCompetitors.length,
          score: Math.round(newScore * 10) / 10,
          brands_json: hasHubSpotMention ? 
            JSON.stringify(['HubSpot Marketing Hub']) : 
            '[]',
          metadata: {
            manual_fix_applied: true,
            original_score: currentScore,
            original_competitors: competitors.length,
            hubspot_reclassified: hasHubSpotMention,
            suspicious_competitors_removed: suspiciousCompetitors.length,
            fixed_at: new Date().toISOString(),
            fixed_by: 'manual-classification-fixer'
          }
        })
        .eq('id', responseId);

      if (error) throw error;

       // Get the actual prompt ID from the response
       const { data: responseData } = await supabase
         .from('prompt_provider_responses')
         .select('prompt_id')
         .eq('id', responseId)
         .single();

       // Invalidate caches to refresh UI with updated data
       invalidateCache();

       toast.success(`✅ Fixed ${provider} response - Score: ${currentScore} → ${Math.round(newScore * 10) / 10}`);
      onFixed?.();
      
    } catch (error) {
      console.error('Fix response error:', error);
      toast.error('Failed to fix response classification');
    } finally {
      setIsFixing(false);
    }
  };

  if (!needsFix) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <CheckCircle className="h-4 w-4" />
        <span>Classification looks correct</span>
      </div>
    );
  }

  return (
    <Card className="p-3 border-amber-200 bg-amber-50 dark:bg-amber-900/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm">Classification Issue Detected</span>
          </div>
          
          <div className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
            {!brandPresent && <div>• Your brand not detected</div>}
            {hubspotAsCompetitor && <div>• HubSpot misclassified as competitor</div>}
            {suspiciousCompetitors.length > 0 && (
              <div>• Generic terms as competitors: {suspiciousCompetitors.join(', ')}</div>
            )}
            {currentScore <= 2 && <div>• Unexpectedly low score ({currentScore}/10)</div>}
          </div>

          {hubspotAsCompetitor && (
            <div className="mt-2 flex flex-wrap gap-1">
              {competitors
                .filter(comp => /hubspot|marketing hub/i.test(comp))
                .map(comp => (
                  <Badge key={comp} variant="destructive" className="text-xs">
                    {comp} ← Your Brand?
                  </Badge>
                ))
              }
            </div>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleFixResponse}
          disabled={isFixing}
          className="shrink-0"
        >
          {isFixing ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Zap className="h-3 w-3 mr-1" />
          )}
          {isFixing ? 'Fixing...' : 'Fix Now'}
        </Button>
      </div>
    </Card>
  );
}