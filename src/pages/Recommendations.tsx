import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Recommendations() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions to improve your search visibility
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Recommendations</CardTitle>
              <CardDescription>
                Action items to improve your AI search performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No recommendations available yet. Run some prompts to get personalized suggestions.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suggested Prompts</CardTitle>
              <CardDescription>
                AI-generated prompts based on your industry and keywords
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No suggested prompts available yet.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}