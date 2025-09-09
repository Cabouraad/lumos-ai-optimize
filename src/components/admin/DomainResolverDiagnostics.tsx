import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, TestTube } from 'lucide-react';
import { resolveDomainToBrand, getKnownMappings, testResolver } from '@/lib/citations/domainResolver';

export function DomainResolverDiagnostics() {
  const [testDomain, setTestDomain] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [showMappings, setShowMappings] = useState(false);
  const [showTestResults, setShowTestResults] = useState(false);

  const handleTestDomain = () => {
    if (!testDomain.trim()) return;
    
    const result = resolveDomainToBrand(testDomain.trim());
    setTestResult({ domain: testDomain.trim(), resolved: result });
  };

  const runFullTest = () => {
    const results = testResolver();
    setTestResult(results);
    setShowTestResults(true);
  };

  const exportMappings = () => {
    const mappings = getKnownMappings();
    const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domain-mappings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const knownMappings = getKnownMappings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Domain Resolver Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single domain test */}
          <div className="flex gap-2">
            <Input 
              placeholder="Enter domain to test (e.g., cars.com, example.org)"
              value={testDomain}
              onChange={(e) => setTestDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTestDomain()}
            />
            <Button onClick={handleTestDomain} disabled={!testDomain.trim()}>
              Test Domain
            </Button>
          </div>

          {/* Single test result */}
          {testResult && !Array.isArray(testResult) && (
            <Card className="p-4 bg-muted/30">
              <div className="space-y-2">
                <div><strong>Domain:</strong> {testResult.domain}</div>
                <div><strong>Resolved Brand:</strong> {testResult.resolved.brand}</div>
                <div><strong>Canonical Domain:</strong> {testResult.resolved.canonicalDomain}</div>
                <div>
                  <strong>Type:</strong> 
                  <Badge 
                    variant={
                      testResult.resolved.type === 'known' ? 'default' :
                      testResult.resolved.type === 'heuristic' ? 'secondary' : 'outline'
                    }
                    className="ml-2"
                  >
                    {testResult.resolved.type}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={runFullTest}>
              <TestTube className="h-4 w-4 mr-2" />
              Run Full Test Suite
            </Button>
            <Button variant="outline" onClick={() => setShowMappings(!showMappings)}>
              {showMappings ? 'Hide' : 'Show'} Known Mappings ({knownMappings.length})
            </Button>
            <Button variant="outline" onClick={exportMappings}>
              <Download className="h-4 w-4 mr-2" />
              Export Mappings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full test results */}
      {showTestResults && Array.isArray(testResult) && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input Domain</TableHead>
                  <TableHead>Resolved Brand</TableHead>
                  <TableHead>Canonical Domain</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testResult.map((result: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{result.domain}</TableCell>
                    <TableCell>{result.resolved.brand}</TableCell>
                    <TableCell className="font-mono text-sm">{result.resolved.canonicalDomain}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          result.resolved.type === 'known' ? 'default' :
                          result.resolved.type === 'heuristic' ? 'secondary' : 'outline'
                        }
                      >
                        {result.resolved.type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Known mappings table */}
      {showMappings && (
        <Card>
          <CardHeader>
            <CardTitle>Known Domain Mappings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Brand Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knownMappings.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{mapping.domain}</TableCell>
                    <TableCell>{mapping.brand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}