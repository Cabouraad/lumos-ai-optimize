import { Layout } from '@/components/Layout';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Bot, Zap, CheckCircle2, Code, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LLMsTextFeature() {
  return (
    <Layout>
      <SEOHelmet 
        title="llms.txt Generator - Optimize Your Site for AI | Llumos"
        description="Generate and optimize your llms.txt file to help AI models understand your website better. Auto-generate or customize your AI-readable site summary."
      />
      
      <div className="space-y-12 pb-12">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">llms.txt Protocol</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Make Your Website
            <span className="text-primary block mt-2">AI-Readable</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Generate an llms.txt file that helps AI models like ChatGPT, Claude, and Perplexity 
            understand and accurately represent your website.
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link to="/llms-txt">Generate Your llms.txt</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://llmstxt.org" target="_blank" rel="noopener noreferrer">
                Learn About Protocol
              </a>
            </Button>
          </div>
        </section>

        {/* What is llms.txt */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">What is llms.txt?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                llms.txt is a standardized file format that provides AI models with structured information 
                about your website. Similar to robots.txt for search engines, it helps AI understand:
              </p>
              <ul className="space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Your website's purpose, products, and services</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Key pages and documentation to reference</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Important keywords and topics you cover</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>How to properly cite and reference your content</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Key Benefits */}
        <section className="container max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-bold">Why You Need llms.txt</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Bot className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Better AI Understanding</CardTitle>
                <CardDescription>
                  Help AI models accurately understand and describe your business, 
                  reducing misinformation and hallucinations.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Increased Visibility</CardTitle>
                <CardDescription>
                  Make it easier for AI models to find and cite your most important 
                  content when users ask relevant questions.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <Code className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Industry Standard</CardTitle>
                <CardDescription>
                  Follow the emerging standard for AI-readable websites, supported by 
                  major AI platforms and content creators.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* How It Works */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Two Ways to Generate Your llms.txt</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <RefreshCw className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Auto-Generate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Let our AI scan your website and automatically generate a comprehensive 
                  llms.txt file based on your content.
                </p>
                <ul className="space-y-2 list-none">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Scans your entire website</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Identifies key pages and topics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Extracts relevant keywords</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Generates structured summary</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Manual Customization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Fill out a simple form with your business information and we'll generate 
                  a customized llms.txt file for you.
                </p>
                <ul className="space-y-2 list-none">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Complete control over content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Specify key pages manually</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Add custom keywords</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Emphasize important information</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Implementation Steps */}
        <section className="container max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Simple Implementation</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get your llms.txt file live in minutes
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-2">
                  1
                </div>
                <CardTitle className="text-lg">Generate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use our tool to auto-generate or manually create your llms.txt content
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-2">
                  2
                </div>
                <CardTitle className="text-lg">Copy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Copy the generated llms.txt content with a single click
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-2">
                  3
                </div>
                <CardTitle className="text-lg">Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Place the file at yoursite.com/llms.txt on your web server
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-2">
                  4
                </div>
                <CardTitle className="text-lg">Done</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI models can now access and understand your website better
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Example */}
        <section className="container max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Example llms.txt File</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# llms.txt - Example Company

## Description
Example Company provides innovative SaaS solutions for
modern businesses, helping teams collaborate better.

## Key Pages
- https://example.com/about
- https://example.com/products
- https://example.com/documentation
- https://example.com/blog

## Keywords
project management, team collaboration, SaaS,
productivity tools, workflow automation`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="container max-w-4xl mx-auto text-center space-y-6 py-12">
          <h2 className="text-3xl font-bold">
            Generate Your llms.txt File Now
          </h2>
          <p className="text-xl text-muted-foreground">
            Join forward-thinking companies optimizing for AI visibility
          </p>
          <Button size="lg" asChild>
            <Link to="/llms-txt">Get Started</Link>
          </Button>
        </section>
      </div>
    </Layout>
  );
}
