/**
 * Test Component for Competitor Display
 * Demonstrates the new competitor chip functionality
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitorChip, CompetitorChipList } from './CompetitorChip';
import { Badge } from '@/components/ui/badge';
import { TestTube } from 'lucide-react';

export function CompetitorDisplayTest() {
  // Test data including valid competitors and invalid terms that should be filtered
  const testCompetitors = [
    // Valid competitors
    'HubSpot',
    'Salesforce', 
    'Zoho CRM',
    'Freshworks',
    'Microsoft',
    'Google Workspace',
    'Pipedrive',
    'Monday.com',
    
    // Invalid terms that should be filtered out
    'using',
    'making',
    'while', 
    'experience',
    'platform',
    'software',
    'solution',
    'tools',
    'implementing',
    'business',
    'customer',
    'marketing'
  ];

  const mixedTestInput = [
    { name: 'HubSpot', mentions: 5, confidence: 0.95 },
    { name: 'using', mentions: 2, confidence: 0.3 }, // Should be filtered
    { name: 'Salesforce', mentions: 3, confidence: 0.9 },
    { name: 'experience', mentions: 1, confidence: 0.2 }, // Should be filtered
    { name: 'Zoho CRM', mentions: 2, confidence: 0.85 },
    { name: 'while', mentions: 1, confidence: 0.1 }, // Should be filtered
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TestTube className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Competitor Display Test</h2>
      </div>

      {/* Test Case 1: Individual Chips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Individual Competitor Chips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <CompetitorChip name="HubSpot" size="sm" mentions={5} confidence={0.95} />
            <CompetitorChip name="Salesforce" size="sm" mentions={3} confidence={0.9} />
            <CompetitorChip name="Zoho CRM" size="md" mentions={2} confidence={0.85} />
            <CompetitorChip name="Unknown Brand" size="sm" mentions={1} confidence={0.6} />
          </div>
          
          <div className="text-xs text-muted-foreground">
            ℹ️ Hover over chips to see tooltips with brand details
          </div>
        </CardContent>
      </Card>

      {/* Test Case 2: Filtered List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtered Competitor List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Input (including invalid terms):</h4>
              <div className="flex flex-wrap gap-1">
                {testCompetitors.map((comp, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {comp}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Output (filtered valid competitors only):</h4>
              <CompetitorChipList 
                competitors={testCompetitors}
                maxDisplay={10}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Case 3: Mixed Input with Confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mixed Input with Confidence Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Input with confidence scores:</h4>
              <div className="text-xs text-muted-foreground font-mono">
                {JSON.stringify(mixedTestInput, null, 2)}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Filtered output:</h4>
              <CompetitorChipList 
                competitors={mixedTestInput}
                maxDisplay={6}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Case 4: Empty State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Empty State Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Input (only invalid terms):</h4>
              <div className="flex flex-wrap gap-1">
                {['using', 'making', 'while', 'experience', 'platform'].map((term, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Output (should show "No competitors found"):</h4>
              <CompetitorChipList 
                competitors={['using', 'making', 'while', 'experience', 'platform']}
                maxDisplay={6}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}