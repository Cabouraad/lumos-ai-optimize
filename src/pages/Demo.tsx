import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Play } from 'lucide-react';

export default function Demo() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Play className="h-4 w-4" />
            <span className="text-sm font-medium">Product Demo</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            See Llumos in Action
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch this comprehensive walkthrough to learn how Llumos helps you track, analyze, and improve your brand's visibility across AI platforms like ChatGPT, Gemini, and Perplexity.
          </p>
        </div>

        {/* Video Card */}
        <Card className="overflow-hidden border-border/50 shadow-elegant">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src="https://www.loom.com/embed/0ccbde75ae6347418f31e9409706d6bf?sid=8e8e9f8f-4e5e-4c5e-9e5e-8f8f8f8f8f8f"
              frameBorder="0"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full"
              title="Llumos Product Demo"
            />
          </div>
        </Card>

        {/* Key Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="p-6 space-y-3 border-border/50 hover:border-primary/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-semibold text-lg">Track Your Brand</h3>
            <p className="text-sm text-muted-foreground">
              Monitor how often AI platforms mention your brand in response to relevant prompts.
            </p>
          </Card>

          <Card className="p-6 space-y-3 border-border/50 hover:border-primary/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-semibold text-lg">Analyze Competitors</h3>
            <p className="text-sm text-muted-foreground">
              See which competitors are being recommended and understand your competitive positioning.
            </p>
          </Card>

          <Card className="p-6 space-y-3 border-border/50 hover:border-primary/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">💡</span>
            </div>
            <h3 className="font-semibold text-lg">Get Recommendations</h3>
            <p className="text-sm text-muted-foreground">
              Receive actionable insights to improve your visibility and outrank competitors.
            </p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
