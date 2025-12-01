import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Sparkles, 
  Target, 
  Search, 
  CheckCircle2, 
  ArrowRight,
  Lightbulb,
  BarChart3,
  Zap,
  BookOpen,
  Bot,
  TrendingUp
} from 'lucide-react';

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Llumos Content Studio",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "AI-powered content creation platform for Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO). Create content that ranks in ChatGPT, Google AI Overviews, Perplexity, and other AI search engines.",
  "offers": {
    "@type": "Offer",
    "price": "79",
    "priceCurrency": "USD"
  },
  "featureList": [
    "AI Content Blueprints",
    "Answer Engine Optimization",
    "Generative Engine Optimization", 
    "Schema Markup Suggestions",
    "AI Writing Assistance",
    "Multi-platform optimization"
  ]
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Answer Engine Optimization (AEO)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer Engine Optimization (AEO) is the practice of optimizing content to appear in AI-powered answer engines like ChatGPT, Google AI Overviews, Perplexity, and Claude. Unlike traditional SEO which focuses on search engine rankings, AEO focuses on making your content the source that AI systems cite when answering user questions."
      }
    },
    {
      "@type": "Question", 
      "name": "What is Generative Engine Optimization (GEO)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Generative Engine Optimization (GEO) is a content strategy focused on optimizing for generative AI platforms. GEO ensures your brand and content are referenced when AI systems generate responses to user queries. This includes optimizing for ChatGPT, Google Gemini, Perplexity AI, and other large language model-based search tools."
      }
    },
    {
      "@type": "Question",
      "name": "How does Content Studio help with AI Search optimization?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Content Studio analyzes your brand's visibility gaps across AI platforms and generates detailed content blueprints designed to improve your AI search presence. It provides structured outlines, FAQ suggestions, schema markup recommendations, and AI writing assistance to create content that AI systems are more likely to cite."
      }
    },
    {
      "@type": "Question",
      "name": "Why is AI content optimization important for brands?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "As more users turn to AI assistants like ChatGPT and Perplexity for product research and recommendations, brands that aren't visible in AI responses lose potential customers. AI content optimization ensures your brand is mentioned when AI systems answer questions relevant to your industry, products, or services."
      }
    }
  ]
};

export default function ContentStudioFeature() {
  return (
    <>
      <Helmet>
        <title>Content Studio for AEO & GEO | AI Search Content Optimization | Llumos</title>
        <meta name="description" content="Create AI-optimized content with Llumos Content Studio. Master Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) to rank in ChatGPT, Google AI Overviews, and Perplexity." />
        <meta name="keywords" content="AEO, Answer Engine Optimization, GEO, Generative Engine Optimization, AI content, AI search optimization, ChatGPT SEO, AI visibility, content studio, AI content strategy" />
        <link rel="canonical" href="https://llumos.ai/features/content-studio" />
        
        <meta property="og:title" content="Content Studio for AEO & GEO | AI Search Content Optimization" />
        <meta property="og:description" content="Create content that ranks in AI search engines. Master Answer Engine Optimization and Generative Engine Optimization with Llumos Content Studio." />
        <meta property="og:url" content="https://llumos.ai/features/content-studio" />
        <meta property="og:type" content="website" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Content Studio for AEO & GEO | Llumos" />
        <meta name="twitter:description" content="Create AI-optimized content that ranks in ChatGPT, Google AI Overviews, and Perplexity." />
        
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/lovable-uploads/a3631033-2657-4c97-8fd8-079913859ab0.png" alt="Llumos - AI Search Visibility Platform" className="h-8" />
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link to="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Resources
              </Link>
              <Button asChild>
                <Link to="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                New Feature for Growth & Pro Plans
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Content Studio for{' '}
                <span className="text-primary">Answer Engine Optimization</span>{' '}
                & Generative Engine Optimization
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Create AI-optimized content that ranks in ChatGPT, Google AI Overviews, Perplexity, and other AI search engines. 
                Master AEO and GEO with data-driven content blueprints and AI writing assistance.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Start Creating AI Content
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/demo">Watch Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* What is AEO/GEO Section */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12">
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">What is Answer Engine Optimization (AEO)?</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  <strong>Answer Engine Optimization (AEO)</strong> is the practice of optimizing your content to appear as 
                  the authoritative source in AI-powered answer engines. Unlike traditional SEO which focuses on ranking 
                  in search results, AEO ensures your brand is cited when AI assistants answer user questions.
                </p>
                <p className="text-muted-foreground">
                  With the rise of ChatGPT, Google AI Overviews, and Perplexity, users increasingly get answers directly 
                  from AI without visiting websites. AEO helps your brand remain visible in this new paradigm of 
                  <strong> AI search</strong> and <strong>conversational search</strong>.
                </p>
              </Card>
              
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">What is Generative Engine Optimization (GEO)?</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  <strong>Generative Engine Optimization (GEO)</strong> focuses on making your content the preferred source 
                  for large language models (LLMs) when they generate responses. GEO strategies ensure your brand, products, 
                  and expertise are woven into AI-generated answers.
                </p>
                <p className="text-muted-foreground">
                  As <strong>generative AI</strong> transforms how people discover brands, GEO becomes essential for 
                  maintaining <strong>AI visibility</strong>. Content Studio provides the frameworks and tools to execute 
                  effective GEO strategies across all major AI platforms.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How Content Studio Works */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How Content Studio Powers Your AI Content Strategy
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Transform visibility gaps into high-performing content that AI systems love to cite
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6">
                <div className="p-3 rounded-lg bg-blue-500/10 w-fit mb-4">
                  <Search className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">1. Identify AI Visibility Gaps</h3>
                <p className="text-muted-foreground">
                  Llumos monitors how often AI platforms mention your brand. When we detect low visibility for 
                  specific topics or queries, Content Studio generates targeted content blueprints to fill those gaps.
                </p>
              </Card>
              
              <Card className="p-6">
                <div className="p-3 rounded-lg bg-green-500/10 w-fit mb-4">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">2. Generate AI-Optimized Blueprints</h3>
                <p className="text-muted-foreground">
                  Each blueprint includes structured outlines, FAQ suggestions, key entities to mention, 
                  schema markup recommendations, and tone guidelines—all designed for maximum AI citation potential.
                </p>
              </Card>
              
              <Card className="p-6">
                <div className="p-3 rounded-lg bg-purple-500/10 w-fit mb-4">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">3. Create with AI Assistance</h3>
                <p className="text-muted-foreground">
                  Use our built-in editor with AI writing assistance to bring blueprints to life. 
                  Get suggestions, expand sections, and ensure your content follows AEO and GEO best practices.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Content Studio Features for AI Search Success
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Everything you need to create content that dominates AI search results
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">LLM-Targeted Content Types</h3>
                  <p className="text-muted-foreground">
                    Generate blueprints for FAQ pages, comparison articles, how-to guides, and landing pages—
                    each optimized for specific AI platforms like ChatGPT, Gemini, or Perplexity.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Structured Content Outlines</h3>
                  <p className="text-muted-foreground">
                    Get detailed section-by-section outlines with talking points designed to match 
                    how AI systems structure and present information to users.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">FAQ & Entity Suggestions</h3>
                  <p className="text-muted-foreground">
                    Receive AI-generated FAQ pairs and key entities to include. These elements help 
                    AI systems understand and accurately represent your content in responses.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Schema Markup Recommendations</h3>
                  <p className="text-muted-foreground">
                    Get suggestions for FAQPage, Article, HowTo, and Product schema types that 
                    improve how AI systems parse and cite your content.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">AI Writing Assistance</h3>
                  <p className="text-muted-foreground">
                    Built-in AI helps you write, expand, and refine content sections. Get suggestions 
                    that maintain your brand voice while optimizing for AI visibility.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Visibility Impact Tracking</h3>
                  <p className="text-muted-foreground">
                    Monitor how your new content affects AI visibility scores. See which pieces 
                    drive the most improvement in brand mentions across AI platforms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked Questions About AI Content Optimization
              </h2>
            </div>
            
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">What is Answer Engine Optimization (AEO)?</h3>
                <p className="text-muted-foreground">
                  Answer Engine Optimization (AEO) is the practice of optimizing content to appear in AI-powered 
                  answer engines like ChatGPT, Google AI Overviews, Perplexity, and Claude. Unlike traditional SEO 
                  which focuses on search engine rankings, AEO focuses on making your content the source that AI 
                  systems cite when answering user questions.
                </p>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">What is Generative Engine Optimization (GEO)?</h3>
                <p className="text-muted-foreground">
                  Generative Engine Optimization (GEO) is a content strategy focused on optimizing for generative 
                  AI platforms. GEO ensures your brand and content are referenced when AI systems generate responses 
                  to user queries. This includes optimizing for ChatGPT, Google Gemini, Perplexity AI, and other 
                  large language model-based search tools.
                </p>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">How does Content Studio help with AI Search optimization?</h3>
                <p className="text-muted-foreground">
                  Content Studio analyzes your brand's visibility gaps across AI platforms and generates detailed 
                  content blueprints designed to improve your AI search presence. It provides structured outlines, 
                  FAQ suggestions, schema markup recommendations, and AI writing assistance to create content that 
                  AI systems are more likely to cite.
                </p>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Why is AI content optimization important for brands?</h3>
                <p className="text-muted-foreground">
                  As more users turn to AI assistants like ChatGPT and Perplexity for product research and 
                  recommendations, brands that aren't visible in AI responses lose potential customers. AI content 
                  optimization ensures your brand is mentioned when AI systems answer questions relevant to your 
                  industry, products, or services.
                </p>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">What's the difference between SEO, AEO, and GEO?</h3>
                <p className="text-muted-foreground">
                  <strong>SEO (Search Engine Optimization)</strong> focuses on ranking in traditional search results. 
                  <strong> AEO (Answer Engine Optimization)</strong> focuses on being cited as a source in AI-generated answers. 
                  <strong> GEO (Generative Engine Optimization)</strong> focuses on influencing how generative AI platforms 
                  represent your brand. Modern content strategies should incorporate all three for maximum visibility.
                </p>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Which AI platforms does Content Studio optimize for?</h3>
                <p className="text-muted-foreground">
                  Content Studio creates content optimized for ChatGPT (OpenAI), Google AI Overviews, Google Gemini, 
                  Perplexity AI, Claude (Anthropic), and other major AI assistants. Each blueprint indicates which 
                  platforms it targets and follows platform-specific best practices for maximum visibility.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-primary text-primary-foreground">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start Creating AI-Optimized Content Today
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join brands using Content Studio to dominate AI search results. 
              Available on Growth and Pro plans.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/signup">
                  Start 7-Day Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <img src="/lovable-uploads/a3631033-2657-4c97-8fd8-079913859ab0.png" alt="Llumos - AI Search Visibility Platform" className="h-6" />
              </Link>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
                <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
                <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
