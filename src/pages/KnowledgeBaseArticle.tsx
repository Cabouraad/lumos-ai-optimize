import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, User, Clock, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { Footer } from '@/components/Footer';

// SEO Props Interface
interface ArticleSEOProps {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  keywords: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  ogImage?: string;
}

// Table of Contents Item
interface TocItem {
  id: string;
  title: string;
  level: number;
}

// Article metadata
const articleSEO: ArticleSEOProps = {
  title: "What is GEO? The Complete Guide to Generative Engine Optimization (2025)",
  metaDescription: "Learn how to rank in AI search engines like ChatGPT, Perplexity, and Gemini. A comprehensive guide to Generative Engine Optimization (GEO) for modern brands.",
  canonicalUrl: "https://llumos.ai/knowledge/geo-guide",
  keywords: "Generative Engine Optimization, GEO, AEO marketing, AI search ranking factors, Optimize for ChatGPT, Google SGE strategy",
  author: "Llumos Team",
  publishedDate: "2025-01-01",
  modifiedDate: "2025-06-05",
  ogImage: "https://llumos.ai/og-geo-guide.png"
};

// Key takeaways
const keyTakeaways = [
  "GEO is the practice of optimizing content for AI-powered search engines like ChatGPT and Perplexity",
  "Traditional SEO focuses on keywords; GEO focuses on context, authority, and conversational relevance",
  "AI engines cite sources differently—understanding citation patterns is crucial",
  "Structured data and semantic HTML significantly improve AI visibility",
  "Monitoring your brand's AI mentions is essential for GEO success"
];

// Table of contents data
const tableOfContents: TocItem[] = [
  { id: "introduction", title: "Introduction to GEO", level: 2 },
  { id: "what-is-geo", title: "What is Generative Engine Optimization?", level: 2 },
  { id: "geo-vs-seo", title: "GEO vs Traditional SEO", level: 2 },
  { id: "how-ai-search-works", title: "How AI Search Engines Work", level: 2 },
  { id: "ranking-factors", title: "AI Search Ranking Factors", level: 2 },
  { id: "optimization-strategies", title: "GEO Optimization Strategies", level: 2 },
  { id: "measuring-success", title: "Measuring GEO Success", level: 2 },
  { id: "future-of-geo", title: "The Future of GEO", level: 2 },
  { id: "conclusion", title: "Conclusion", level: 2 },
];

// JSON-LD Structured Data
const generateArticleSchema = (seo: ArticleSEOProps) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": seo.title,
  "description": seo.metaDescription,
  "keywords": seo.keywords,
  "author": {
    "@type": "Organization",
    "name": seo.author || "Llumos",
    "url": "https://llumos.ai"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Llumos",
    "logo": {
      "@type": "ImageObject",
      "url": "https://llumos.ai/logo.png"
    }
  },
  "datePublished": seo.publishedDate,
  "dateModified": seo.modifiedDate,
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": seo.canonicalUrl
  },
  "image": seo.ogImage
});

const KnowledgeBaseArticle = () => {
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Intersection Observer for auto-highlighting ToC
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    // Observe all sections
    tableOfContents.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        sectionRefs.current[item.id] = element;
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <Helmet>
        <title>{articleSEO.title}</title>
        <meta name="description" content={articleSEO.metaDescription} />
        <meta name="keywords" content={articleSEO.keywords} />
        <meta name="author" content={articleSEO.author} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={articleSEO.canonicalUrl} />
        
        {/* Open Graph */}
        <meta property="og:title" content={articleSEO.title} />
        <meta property="og:description" content={articleSEO.metaDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleSEO.canonicalUrl} />
        <meta property="og:image" content={articleSEO.ogImage} />
        <meta property="article:published_time" content={articleSEO.publishedDate} />
        <meta property="article:modified_time" content={articleSEO.modifiedDate} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={articleSEO.title} />
        <meta name="twitter:description" content={articleSEO.metaDescription} />
        <meta name="twitter:image" content={articleSEO.ogImage} />
        
        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(generateArticleSchema(articleSEO))}
        </script>
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Llumos</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar - Table of Contents */}
            <aside className="hidden lg:block lg:col-span-3">
              <nav className="sticky top-24">
                <Card className="p-4 bg-muted/30 border-border/50">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                    Table of Contents
                  </h3>
                  <ul className="space-y-2">
                    {tableOfContents.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => scrollToSection(item.id)}
                          className={`text-left w-full text-sm py-1.5 px-3 rounded-md transition-all duration-200 ${
                            activeSection === item.id
                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-6">
              <article className="prose prose-slate dark:prose-invert max-w-none">
                
                {/* H1 Title */}
                <header className="mb-8">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
                    What is GEO? The Complete Guide to Generative Engine Optimization (2025)
                  </h1>
                  
                  {/* Author Bio */}
                  <div className="flex items-center gap-4 py-4 border-y border-border">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Written by Llumos Team</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          January 1, 2025
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          12 min read
                        </span>
                      </div>
                    </div>
                  </div>
                </header>

                {/* Key Takeaways Box */}
                <Card className="p-6 bg-primary/5 border-primary/20 mb-8">
                  <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Key Takeaways
                  </h2>
                  <ul className="space-y-2">
                    {keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-primary mt-1">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Article Content Sections */}
                <section id="introduction" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">Introduction to GEO</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    The way people search for information is fundamentally changing. With the rise of AI-powered search engines like ChatGPT, Perplexity, and Google's AI Overviews, brands need to adapt their visibility strategies. Welcome to the era of <strong className="text-foreground">Generative Engine Optimization (GEO)</strong>.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    This comprehensive guide will walk you through everything you need to know about GEO—from understanding how AI search engines work to implementing strategies that increase your brand's visibility in AI-generated responses.
                  </p>
                </section>

                <section id="what-is-geo" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">What is Generative Engine Optimization?</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    <strong className="text-foreground">Generative Engine Optimization (GEO)</strong> is the practice of optimizing your content to appear in AI-generated search results. Unlike traditional SEO, which focuses on ranking in a list of blue links, GEO aims to get your brand mentioned, cited, or recommended by AI assistants.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    When users ask ChatGPT "What's the best project management tool?" or query Perplexity about "top marketing automation platforms," GEO ensures your brand is part of that conversation.
                  </p>
                </section>

                <section id="geo-vs-seo" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">GEO vs Traditional SEO</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    While GEO and SEO share some foundational principles, they differ significantly in execution:
                  </p>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Traditional SEO</h3>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
                    <li>Focuses on keyword placement and density</li>
                    <li>Prioritizes backlinks and domain authority</li>
                    <li>Optimizes for specific search queries</li>
                    <li>Success measured by rankings and click-through rates</li>
                  </ul>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Generative Engine Optimization</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Focuses on contextual relevance and authority signals</li>
                    <li>Prioritizes being cited by AI models</li>
                    <li>Optimizes for conversational, long-tail queries</li>
                    <li>Success measured by brand mentions in AI responses</li>
                  </ul>
                </section>

                <section id="how-ai-search-works" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">How AI Search Engines Work</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    AI search engines like ChatGPT, Perplexity, and Gemini use large language models (LLMs) trained on vast datasets. They generate responses by synthesizing information from multiple sources, rather than simply returning a list of links.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Understanding this fundamentally different approach is crucial for GEO success. These AI systems evaluate content based on authority, recency, contextual relevance, and how well information answers user intent.
                  </p>
                </section>

                <section id="ranking-factors" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">AI Search Ranking Factors</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Research suggests several key factors influence whether AI engines cite your content:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li><strong className="text-foreground">Authority Signals:</strong> Established expertise and trustworthiness</li>
                    <li><strong className="text-foreground">Content Freshness:</strong> Up-to-date, regularly maintained content</li>
                    <li><strong className="text-foreground">Structured Data:</strong> Schema markup and semantic HTML</li>
                    <li><strong className="text-foreground">Comprehensive Coverage:</strong> Thorough treatment of topics</li>
                    <li><strong className="text-foreground">Citation Patterns:</strong> Being referenced by other authoritative sources</li>
                  </ul>
                </section>

                <section id="optimization-strategies" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">GEO Optimization Strategies</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Implementing GEO requires a multi-faceted approach. Here are proven strategies to increase your AI visibility:
                  </p>
                  <h3 className="text-xl font-semibold text-foreground mb-3">1. Create Authoritative, Comprehensive Content</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    AI engines favor content that thoroughly covers topics. Create in-depth guides, research-backed articles, and comprehensive resources that establish your expertise.
                  </p>
                  <h3 className="text-xl font-semibold text-foreground mb-3">2. Implement Structured Data</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Use JSON-LD schema markup to help AI systems understand your content's context, relationships, and relevance.
                  </p>
                  <h3 className="text-xl font-semibold text-foreground mb-3">3. Build Citation Networks</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Get mentioned by authoritative sources in your industry. The more quality references point to your brand, the more likely AI systems will include you in responses.
                  </p>
                </section>

                <section id="measuring-success" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">Measuring GEO Success</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Traditional analytics don't capture AI visibility. To measure GEO success, you need specialized tools that track:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Brand mention frequency across AI platforms</li>
                    <li>Citation quality and context</li>
                    <li>Competitor visibility comparisons</li>
                    <li>Trend analysis over time</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    Tools like <strong className="text-foreground">Llumos</strong> help brands track their AI visibility across ChatGPT, Perplexity, Gemini, and other AI search engines.
                  </p>
                </section>

                <section id="future-of-geo" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">The Future of GEO</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    As AI search continues to evolve, GEO will become increasingly important. Industry analysts predict that by 2026, over 50% of search queries will be handled by AI-powered systems.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Brands that invest in GEO now will have a significant competitive advantage as the search landscape continues to shift toward AI-first experiences.
                  </p>
                </section>

                <section id="conclusion" className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold text-foreground mb-4">Conclusion</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Generative Engine Optimization represents the next frontier of search visibility. By understanding how AI search engines work and implementing targeted optimization strategies, brands can ensure they remain visible in this new era of search.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    The time to start optimizing for AI search is now. Whether you're a marketing leader, SEO professional, or business owner, GEO should be a key part of your digital strategy.
                  </p>
                </section>

              </article>
            </main>

            {/* Right Sidebar - CTA */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-24">
                <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                  <div className="text-center">
                    <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      Check Your AI Score for Free
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      See how visible your brand is across ChatGPT, Perplexity, and other AI search engines.
                    </p>
                    <Button asChild className="w-full">
                      <Link to="/#audit">
                        Get Your Score
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>

                {/* Secondary CTA */}
                <Card className="p-4 mt-4 border-border/50">
                  <p className="text-sm text-muted-foreground mb-3">
                    Want to learn more about AI visibility?
                  </p>
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/resources">
                      Browse Resources
                    </Link>
                  </Button>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default KnowledgeBaseArticle;
