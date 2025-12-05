import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, User, ArrowRight, Sparkles, Search } from 'lucide-react';
import { SEOHelmet, structuredDataGenerators } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';
import { motion } from 'framer-motion';
import { OptimizedImage } from '@/components/OptimizedImage';

// Import blog images
import heroImage from '@/assets/blog/chatgpt-optimization-hero.jpg';
import answerFirstImage from '@/assets/blog/answer-first-content-structure.jpg';
import entityDensityImage from '@/assets/blog/entity-density-optimization.jpg';
import statisticsImage from '@/assets/blog/quotable-statistics-geo.jpg';

const BlogPostGPT = () => {
  return (
    <>
      <SEOHelmet
        title="How to Optimize for ChatGPT Search: The 2025 GEO Guide"
        description="Is your brand invisible in AI answers? Learn the 5 core strategies of Generative Engine Optimization (GEO) to get cited by ChatGPT, Perplexity, and Gemini."
        canonicalPath="/blog/how-to-optimize-for-chatgpt-search"
        ogType="article"
        schemaType="Article"
        publishedDate="2025-12-04"
        authorName="Llumos Editorial Team"
        keywords="GEO, Generative Engine Optimization, ChatGPT SEO, AI search optimization, brand visibility AI, Perplexity optimization, Gemini search"
        ogImage={heroImage}
        structuredData={[
          structuredDataGenerators.breadcrumb([
            { name: "Home", url: "/" },
            { name: "Resources", url: "/resources" },
            { name: "How to Optimize for ChatGPT Search", url: "/blog/how-to-optimize-for-chatgpt-search" }
          ])
        ]}
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Search className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">Llumos</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">Resources</Link>
              <Button variant="outline" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Article */}
        <article className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            {/* Back Link */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Link 
                to="/resources" 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Resources
              </Link>
            </motion.div>

            {/* Article Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <Badge variant="secondary" className="mb-4 text-sm">
                AI Optimization Guides
              </Badge>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                How to Optimize Your Brand for ChatGPT Search (The 2025 GEO Guide)
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-8 pb-8 border-b">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Llumos Editorial Team</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <time dateTime="2025-12-04">December 4, 2025</time>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>8 min read</span>
                </div>
              </div>

              {/* Hero Image */}
              <figure className="mb-10">
                <OptimizedImage
                  src={heroImage}
                  alt="ChatGPT search optimization concept showing AI neural network connected to search interface - Generative Engine Optimization (GEO) visualization"
                  className="w-full h-auto rounded-xl shadow-lg"
                  priority
                />
                <figcaption className="text-sm text-muted-foreground mt-3 text-center">
                  AI search optimization: How ChatGPT and other LLMs process and cite content sources
                </figcaption>
              </figure>
            </motion.div>

            {/* Article Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-3xl mx-auto prose prose-lg dark:prose-invert"
            >
              {/* Introduction */}
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                The era of "10 blue links" is ending. Today, 50% of product searches start on Amazon or AI platforms, not Google. 
                You might rank #1 on Google, yet be completely invisible when a user asks ChatGPT, "What is the best tool for X?" 
                This guide covers <strong>Generative Engine Optimization (GEO)</strong>—the new art of optimizing for Answer Engines.
              </p>

              {/* Section 1 */}
              <section className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 mt-12">
                  1. Adopt an "Answer-First" Content Structure
                </h2>
                
                <figure className="my-6">
                  <img
                    src={answerFirstImage}
                    alt="Answer-first content structure diagram showing organized text blocks flowing into an AI brain for optimal LLM comprehension"
                    className="w-full h-auto rounded-lg shadow-md"
                    loading="lazy"
                    decoding="async"
                    width="800"
                    height="608"
                  />
                  <figcaption className="text-sm text-muted-foreground mt-2 text-center">
                    Structure your content so AI can easily extract and summarize key answers
                  </figcaption>
                </figure>
                
                <p className="text-foreground/90 leading-relaxed mb-4">
                  LLMs are lazy. They prefer content that is easy to summarize. Stop hiding your main point.
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Use <strong>Answer Capsules</strong>: immediately follow every H2 header with a direct, 50-word definition 
                  before expanding into details. If you answer the user's intent instantly, the AI is more likely to cite 
                  you as the source.
                </p>
              </section>

              {/* Section 2 */}
              <section className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 mt-12">
                  2. Optimize for "Entity Density"
                </h2>
                
                <figure className="my-6">
                  <img
                    src={entityDensityImage}
                    alt="Entity density visualization showing interconnected knowledge graph nodes representing brands, concepts, and people that AI models recognize"
                    className="w-full h-auto rounded-lg shadow-md"
                    loading="lazy"
                    decoding="async"
                    width="800"
                    height="608"
                  />
                  <figcaption className="text-sm text-muted-foreground mt-2 text-center">
                    AI models understand entities (brands, concepts, people) better than keywords
                  </figcaption>
                </figure>
                
                <p className="text-foreground/90 leading-relaxed mb-4">
                  Search engines used to look for keywords; AI models look for <strong>Entities</strong> (Concepts, Brands, People).
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Ensure your "About Us" page clearly defines who you are using simple, factual language. 
                  If the AI doesn't understand your entity, it won't recommend you.
                </p>
              </section>

              {/* Section 3 */}
              <section className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 mt-12">
                  3. The Power of "Quotable" Statistics
                </h2>
                
                <figure className="my-6">
                  <img
                    src={statisticsImage}
                    alt="Data analytics dashboard showing quotable statistics and benchmarks that AI models cite as authoritative sources"
                    className="w-full h-auto rounded-lg shadow-md"
                    loading="lazy"
                    decoding="async"
                    width="800"
                    height="608"
                  />
                  <figcaption className="text-sm text-muted-foreground mt-2 text-center">
                    Original statistics and data points make your content more likely to be cited by AI
                  </figcaption>
                </figure>
                
                <p className="text-foreground/90 leading-relaxed mb-4">
                  AI models prioritize sources that provide unique data points to back up claims. 
                  To get cited, you must be <strong>the source of the truth</strong>.
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Publish original benchmarks or industry stats. When ChatGPT needs to prove a point, 
                  it will link to the data source.
                </p>
              </section>

              {/* Section 4 */}
              <section className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 mt-12">
                  4. Technical GEO: The llms.txt File
                </h2>
                <p className="text-foreground/90 leading-relaxed mb-4">
                  Just as <code className="bg-muted px-2 py-1 rounded text-sm">robots.txt</code> tells Google where to go, 
                  a proposed standard called <code className="bg-muted px-2 py-1 rounded text-sm">llms.txt</code> helps 
                  AI crawlers find your most important content.
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Create a simple text file listing your top 10 most valuable guides and link to it from your footer.
                </p>
              </section>

              {/* Section 5 */}
              <section className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 mt-12">
                  5. Measuring Success: Share of Model (SoM)
                </h2>
                <p className="text-foreground/90 leading-relaxed mb-4">
                  You can't track clicks easily in zero-click environments, so you must track <strong>mentions</strong>. 
                  This is called "Share of Model".
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Doing this manually is impossible.
                </p>
              </section>

              {/* CTA Box */}
              <Card className="mt-12 p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      Don't Fly Blind in the Age of AI
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Llumos automates this entire process, scanning ChatGPT, Gemini, and Perplexity daily 
                      to give you a visibility score. See exactly how often AI recommends your brand—and your competitors.
                    </p>
                    <Button asChild size="lg" className="gap-2">
                      <Link to="/free-checker">
                        Check Your Free Llumos Score
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </article>

        <Footer />
      </div>
    </>
  );
};

export default BlogPostGPT;
