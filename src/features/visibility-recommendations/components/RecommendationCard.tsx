import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface RecommendationCardProps {
  recommendation: {
    id: string;
    channel: string;
    subtype: string;
    title: string;
    outline: any;
    posting_instructions: string;
    must_include: any;
    where_to_publish: any;
    citations_used: any[];
    success_metrics: any[];
    score_before: number;
  };
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const isContent = recommendation.channel === 'content';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
      
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isContent ? "default" : "secondary"}>
                {recommendation.channel}
              </Badge>
              <Badge variant="outline">
                {recommendation.subtype.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {recommendation.score_before?.toFixed(1)}% visibility
              </Badge>
            </div>
            <CardTitle className="text-xl">{recommendation.title}</CardTitle>
            <CardDescription>
              {isContent ? 'Content Strategy' : 'Social Media Strategy'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(recommendation.title, 'Title')}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Outline */}
        {recommendation.outline && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {isContent ? 'Content Outline' : 'Post Structure'}
            </h4>
            <div className="space-y-2 pl-6">
              {isContent ? (
                Array.isArray(recommendation.outline) && recommendation.outline.map((section: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-medium text-sm">{section.h2}</p>
                    {section.h3 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground pl-4">
                        {section.h3.map((h3: string, i: number) => (
                          <li key={i}>{h3}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                recommendation.outline.body_bullets && (
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {recommendation.outline.body_bullets.map((bullet: string, i: number) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
        )}

        {/* Must Include */}
        {recommendation.must_include && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Must Include</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {recommendation.must_include.entities && (
                <div>
                  <p className="font-medium mb-1">Entities</p>
                  <div className="flex flex-wrap gap-1">
                    {recommendation.must_include.entities.map((e: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {recommendation.must_include.keywords && (
                <div>
                  <p className="font-medium mb-1">Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {recommendation.must_include.keywords.map((k: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {recommendation.must_include.faqs && (
                <div className="col-span-2">
                  <p className="font-medium mb-1">FAQs to Address</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground">
                    {recommendation.must_include.faqs.map((faq: string, i: number) => (
                      <li key={i}>{faq}</li>
                    ))}
                  </ul>
                </div>
              )}
              {recommendation.must_include.schema && (
                <div className="col-span-2">
                  <p className="font-medium mb-1">Schema Markup</p>
                  <div className="flex flex-wrap gap-1">
                    {recommendation.must_include.schema.map((s: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Where to Publish */}
        {recommendation.where_to_publish && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Where to Publish</h4>
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {recommendation.where_to_publish.path || 
                 recommendation.where_to_publish.platform || 
                 'See instructions'}
              </code>
            </div>
          </div>
        )}

        {/* Implementation Instructions */}
        {recommendation.posting_instructions && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center justify-between">
              Implementation Steps
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(recommendation.posting_instructions, 'Instructions')}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </h4>
            <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-line">
              {recommendation.posting_instructions}
            </div>
          </div>
        )}

        {/* Citations */}
        {recommendation.citations_used && recommendation.citations_used.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Reference These Sources</h4>
            <div className="space-y-1">
              {recommendation.citations_used.slice(0, 5).map((cite: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {cite.domain}
                  </Badge>
                  {cite.title && (
                    <span className="text-muted-foreground truncate">
                      {cite.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Metrics */}
        {recommendation.success_metrics && recommendation.success_metrics.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Success Metrics</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {recommendation.success_metrics.map((metric: string, i: number) => (
                <li key={i}>{metric}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
