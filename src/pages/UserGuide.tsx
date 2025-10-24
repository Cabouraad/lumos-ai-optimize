import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Users, Lightbulb, Plus, Edit, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function UserGuide() {
  return (
    <Layout>
      <Helmet>
        <title>User Guide - Llumos</title>
        <meta name="description" content="Complete guide to using Llumos for LLM visibility optimization. Learn how to track prompts, analyze competitors, and implement AI-generated recommendations." />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-bold mb-3 text-gradient">User Guide</h1>
          <p className="text-lg text-muted-foreground">
            Learn how to maximize your LLM visibility with Llumos
          </p>
        </header>

        <Separator className="my-8" />

        {/* Prompts Section */}
        <section>
          <Card className="border-primary/20 bg-card/30 backdrop-blur-sm shadow-elegant">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Getting Started with Prompts</CardTitle>
              </div>
              <CardDescription className="text-base">
                Track and monitor how AI models respond to prompts related to your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Business Context */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                  Add Your Business Context
                </h3>
                <p className="text-muted-foreground mb-3">
                  Start by navigating to the <strong>Prompts</strong> page and click on the <strong>"Business Context"</strong> tab.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Add keywords that describe your business, products, and services</li>
                  <li>These keywords help our AI generate relevant prompts to track</li>
                  <li>Include industry-specific terms, product names, and competitor brands</li>
                </ul>
              </div>

              <Separator />

              {/* Generate Prompts */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                  Generate AI-Powered Prompts
                </h3>
                <p className="text-muted-foreground mb-3">
                  After adding your business context, navigate to the <strong>"Prompt Suggestions"</strong> tab to see AI-generated recommendations.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Review the suggested prompts based on your business context</li>
                  <li>Click <strong>"Accept"</strong> to start tracking a prompt</li>
                  <li>Accepted prompts will automatically be monitored daily</li>
                  <li>You can dismiss prompts that aren't relevant to your business</li>
                </ul>
              </div>

              <Separator />

              {/* Manual Prompts */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                  Add Prompts Manually
                </h3>
                <p className="text-muted-foreground mb-3">
                  You can also add custom prompts to track on the <strong>"My Prompts"</strong> tab.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Click the <Plus className="h-4 w-4 inline" /> <strong>"Add Prompt"</strong> button</li>
                  <li>Enter the exact question or prompt users might ask AI models</li>
                  <li>Examples: "What's the best CRM software?" or "How to improve SEO rankings?"</li>
                  <li>Toggle prompts active/inactive to pause or resume tracking</li>
                  <li>View performance metrics like mentions, visibility score, and trends</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Competitors Section */}
        <section>
          <Card className="border-primary/20 bg-card/30 backdrop-blur-sm shadow-elegant">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Understanding Competitors</CardTitle>
              </div>
              <CardDescription className="text-base">
                Analyze how your brand compares to competitors in AI responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* What's Displayed */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Information Displayed
                </h3>
                <p className="text-muted-foreground mb-3">
                  The Competitors page shows comprehensive insights about your competitive landscape:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Overall Share:</strong> Your brand's percentage of total mentions across all tracked prompts</li>
                  <li><strong>Mentions:</strong> How many times each competitor appears in AI responses</li>
                  <li><strong>Share of Voice:</strong> Each competitor's percentage of the total mentions</li>
                  <li><strong>Trending:</strong> Visual indicators showing if mentions are increasing or decreasing</li>
                  <li><strong>Head-to-Head Comparison:</strong> Direct comparison charts between your brand and competitors</li>
                </ul>
              </div>

              <Separator />

              {/* Editing Competitors */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  Managing Your Competitor List
                </h3>
                <p className="text-muted-foreground mb-3">
                  Keep your competitor tracking accurate by managing the competitor catalog:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Click <strong>"Edit Competitors"</strong> to manage your tracked competitors</li>
                  <li>Add new competitors to monitor their AI visibility</li>
                  <li>Remove competitors that are no longer relevant</li>
                  <li>The system automatically detects competitors mentioned in AI responses</li>
                  <li>Mark detected competitors as relevant or not relevant to your business</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Optimizations Section */}
        <section>
          <Card className="border-primary/20 bg-card/30 backdrop-blur-sm shadow-elegant">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Optimizations & Recommendations</CardTitle>
              </div>
              <CardDescription className="text-base">
                Get AI-powered recommendations to improve your LLM visibility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Generate Optimizations */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                  Generate New Recommendations
                </h3>
                <p className="text-muted-foreground mb-3">
                  On the Optimizations page, click <strong>"Generate Recommendations"</strong> to receive personalized optimization strategies.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>AI analyzes your current visibility data and performance metrics</li>
                  <li>Generates specific, actionable recommendations to improve your presence</li>
                  <li>Each recommendation includes estimated impact and priority level</li>
                  <li>Recommendations are categorized: Content, Technical, Distribution, SEO, and Partnerships</li>
                </ul>
              </div>

              <Separator />

              {/* What to Do */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Taking Action on Recommendations
                </h3>
                <p className="text-muted-foreground mb-3">
                  Each recommendation card provides three action options:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Mark Complete:</strong> Once implemented, mark the task as done to track your progress</li>
                  <li><strong>Snooze:</strong> Temporarily hide recommendations you'll address later</li>
                  <li><strong>Dismiss:</strong> Remove recommendations that aren't applicable to your business</li>
                </ul>
              </div>

              <Separator />

              {/* Implementation Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Viewing Implementation Details
                </h3>
                <p className="text-muted-foreground mb-3">
                  Click <strong>"Show Implementation Details"</strong> on any recommendation card to reveal:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Step-by-Step Instructions:</strong> Detailed action items to implement the recommendation</li>
                  <li><strong>Estimated Timeline:</strong> How long the implementation typically takes</li>
                  <li><strong>Required Resources:</strong> Team members, tools, or budget needed</li>
                  <li><strong>Expected Impact:</strong> Quantified metrics on how this will improve your visibility</li>
                  <li><strong>Key Performance Indicators (KPIs):</strong> Metrics to track after implementation</li>
                  <li><strong>Related Prompts:</strong> Specific prompts that will benefit from this optimization</li>
                </ul>
              </div>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <strong>Pro Tip:</strong> Focus on high-impact, low-effort recommendations first to see quick wins in your LLM visibility scores.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Getting Help */}
        <Card className="border-border/30 bg-card/20">
          <CardHeader>
            <CardTitle>Need More Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              If you have questions or need assistance, reach out to our support team at{' '}
              <a href="mailto:support@llumos.com" className="text-primary hover:underline">
                support@llumos.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
