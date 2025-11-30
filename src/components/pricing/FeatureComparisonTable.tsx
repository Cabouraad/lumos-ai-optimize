import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  {
    category: 'AI Platform Coverage',
    features: [
      { name: 'ChatGPT (OpenAI)', starter: true, growth: true, pro: true },
      { name: 'Perplexity AI', starter: true, growth: true, pro: true },
      { name: 'Google Gemini', starter: false, growth: true, pro: true },
      { name: 'Google AI Overviews', starter: false, growth: true, pro: true }
    ]
  },
  {
    category: 'Tracking & Monitoring',
    features: [
      { name: 'Team members', starter: '1 user', growth: '3 users', pro: '10 users' },
      { name: 'Daily prompt tracking', starter: '25', growth: '100', pro: '300' },
      { name: 'Real-time updates', starter: true, growth: true, pro: true },
      { name: 'Historical data', starter: '30 days', growth: '90 days', pro: 'Unlimited' },
      { name: 'Brand catalog tracking', starter: true, growth: true, pro: true }
    ]
  },
  {
    category: 'Visibility Analytics',
    features: [
      { name: 'Visibility scoring', starter: 'Basic', growth: 'Advanced', pro: 'Advanced' },
      { name: 'Competitor tracking', starter: false, growth: '50 competitors', pro: '50 competitors' },
      { name: 'Market positioning insights', starter: false, growth: true, pro: true },
      { name: 'Trend analysis', starter: false, growth: true, pro: true }
    ]
  },
  {
    category: 'Recommendations & Content',
    features: [
      { name: 'AI-powered optimizations', starter: false, growth: true, pro: true },
      { name: 'Content suggestions', starter: false, growth: true, pro: true },
      { name: 'Content Studio', starter: false, growth: true, pro: true },
      { name: 'Positioning recommendations', starter: false, growth: true, pro: true },
      { name: 'Custom optimization plans', starter: false, growth: false, pro: true }
    ]
  },
  {
    category: 'Reporting & Support',
    features: [
      { name: 'Weekly email reports', starter: true, growth: true, pro: true },
      { name: 'Advanced reporting dashboard', starter: false, growth: true, pro: true },
      { name: 'Export capabilities', starter: false, growth: true, pro: true },
      { name: 'Email support', starter: true, growth: 'Priority', pro: 'Priority' },
      { name: 'Dedicated account manager', starter: false, growth: false, pro: true }
    ]
  }
];

export function FeatureComparisonTable() {
  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle className="w-5 h-5 text-primary mx-auto" />
      ) : (
        <XCircle className="w-5 h-5 text-muted-foreground/30 mx-auto" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Feature Comparison</CardTitle>
        <p className="text-center text-muted-foreground">
          Compare features across all plans
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-4 font-semibold">Feature</th>
                <th className="text-center p-4 font-semibold">
                  <div>Starter</div>
                  <Badge variant="outline" className="mt-1 text-xs">$39/mo</Badge>
                </th>
                <th className="text-center p-4 font-semibold bg-primary/5">
                  <div>Growth</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Badge className="text-xs">Most Popular</Badge>
                    <Badge variant="outline" className="text-xs">$89/mo</Badge>
                  </div>
                </th>
                <th className="text-center p-4 font-semibold">
                  <div>Pro</div>
                  <Badge variant="outline" className="mt-1 text-xs">$250/mo</Badge>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((category, catIndex) => (
                <>
                  <tr key={`cat-${catIndex}`} className="bg-muted/10">
                    <td colSpan={4} className="p-3 font-semibold text-sm">
                      {category.category}
                    </td>
                  </tr>
                  {category.features.map((feature, featIndex) => (
                    <tr 
                      key={`feat-${catIndex}-${featIndex}`}
                      className={`border-b ${featIndex % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}
                    >
                      <td className="p-4 text-sm">{feature.name}</td>
                      <td className="p-4 text-center">{renderValue(feature.starter)}</td>
                      <td className="p-4 text-center bg-primary/5">{renderValue(feature.growth)}</td>
                      <td className="p-4 text-center">{renderValue(feature.pro)}</td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}