import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function TestPerplexityKey() {
  const [testKey, setTestKey] = useState('');
  const [provider, setProvider] = useState('perplexity');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; model?: string } | null>(null);

  const handleTestKey = async () => {
    if (!testKey.trim()) {
      setResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Test with a simple prompt
      const testPrompt = "What is artificial intelligence?";
      
      const { data, error } = await supabase.functions.invoke('test-prompt-response', {
        body: {
          prompt: testPrompt,
          provider: provider
        }
      });

      if (error) {
        setResult({ 
          success: false, 
          message: `API Error: ${error.message}` 
        });
      } else if (data && data.response) {
        setResult({ 
          success: true, 
          message: `Success! ${provider.charAt(0).toUpperCase() + provider.slice(1)} API is working correctly.`,
          model: data.model || 'unknown'
        });
      } else {
        setResult({ 
          success: false, 
          message: 'No response received from API' 
        });
      }
    } catch (err: any) {
      setResult({ 
        success: false, 
        message: `Test failed: ${err.message}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Test AI Provider API Key</CardTitle>
          <CardDescription>
            Test your AI provider API key to ensure it's working correctly with the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium mb-2">
              Select Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={isLoading}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="openai">OpenAI</option>
              <option value="perplexity">Perplexity</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          
          <div>
            <Input
              type="password"
              placeholder={`Enter your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key...`}
              value={testKey}
              onChange={(e) => setTestKey(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <Button 
            onClick={handleTestKey}
            disabled={isLoading || !testKey.trim()}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test API Key
          </Button>

          {result && (
            <Alert className={result.success ? "border-green-200" : "border-red-200"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  {result.message}
                  {result.model && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      Successfully connected using model: {result.model}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}