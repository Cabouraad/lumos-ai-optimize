import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Prompts() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prompts</h1>
            <p className="text-muted-foreground">
              Manage and monitor your AI search prompts
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Prompt
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Prompts</CardTitle>
            <CardDescription>
              Track how your brand appears in AI search results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No prompts created yet. Add your first prompt to start monitoring.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}