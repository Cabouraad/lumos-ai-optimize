import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Tag, BookOpen, TrendingUp, Search } from 'lucide-react';
import { getAllBlogPosts, getFeaturedPosts } from '@/data/blog-posts';
import { generateMetaTags, generateStructuredData, createBreadcrumbStructuredData } from '@/lib/seo';

const Resources = () => {
  const allPosts = getAllBlogPosts();
  const featuredPosts = getFeaturedPosts();
  
  const metaTags = generateMetaTags({
    title: "AI Search Resources & Insights",
    description: "Expert guides, industry insights, and best practices for tracking and improving your brand visibility on AI-powered search engines like ChatGPT, Claude, and Perplexity.",
    keywords: "AI search resources, brand visibility guides, ChatGPT optimization, AI SEO best practices, competitor analysis guides",
    canonicalUrl: "/resources",
    ogType: "website"
  });

  const structuredData = generateStructuredData('WebSite', {
    name: "Llumos Resources",
    description: "Expert guides and insights for AI search optimization",
    url: "https://llumos.ai/resources"
  });

  const breadcrumbData = createBreadcrumbStructuredData([
    { name: "Home", url: "/" },
    { name: "Resources", url: "/resources" }
  ]);

  return (
    <>
      <Helmet>
        <title>{metaTags.title}</title>
        {metaTags.meta.map((tag, index) => (
          <meta key={index} {...tag} />
        ))}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbData)}
        </script>
      </Helmet>

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
              <Link to="/resources" className="text-foreground font-medium">Resources</Link>
              <Button variant="outline" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Hero Section */}
          <section className="text-center mb-16">
            <div className="flex items-center justify-center mb-4">
              <BookOpen className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              AI Search Resources & Insights
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Expert guides, industry insights, and proven strategies to help you track and improve your brand visibility on AI-powered search engines.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Search className="w-4 h-4" />
                AI Search Optimization
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Brand Visibility Tracking
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                Industry Best Practices
              </span>
            </div>
          </section>

          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <section className="mb-16">
              <h2 className="text-3xl font-bold text-foreground mb-8">Featured Articles</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {featuredPosts.map((post) => (
                  <Card key={post.slug} className="p-8 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Tag className="w-4 h-4" />
                      <span>{post.category}</span>
                      <span>•</span>
                      <Calendar className="w-4 h-4" />
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long', 
                          day: 'numeric'
                        })}
                      </time>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground mb-4 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground mb-6 line-clamp-2">
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {post.readTime} min read
                        </span>
                      </div>
                      <Button asChild>
                        <Link to={`/resources/${post.slug}`}>Read Article</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* All Posts */}
          <section>
            <h2 className="text-3xl font-bold text-foreground mb-8">All Resources</h2>
            <div className="grid gap-6">
              {allPosts.map((post) => (
                <Card key={post.slug} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Tag className="w-4 h-4" />
                        <span>{post.category}</span>
                        <span>•</span>
                        <Calendar className="w-4 h-4" />
                        <time dateTime={post.publishedAt}>
                          {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                        <span>•</span>
                        <Clock className="w-4 h-4" />
                        <span>{post.readTime} min read</span>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {post.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {post.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {post.tags.map((tag) => (
                          <span key={tag} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Button asChild>
                        <Link to={`/resources/${post.slug}`}>Read More</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="mt-20 text-center bg-primary/5 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Track Your AI Search Performance?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Put these insights into action. Start tracking how your brand performs across AI-powered search engines today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/auth">Start Free Trial</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              14-day free trial • No credit card required
            </p>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-12 px-4 border-t bg-background mt-20">
          <div className="container mx-auto max-w-4xl text-center">
            <Link to="/" className="flex items-center justify-center space-x-2 mb-4">
              <Search className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-foreground">Llumos</span>
            </Link>
            <p className="text-muted-foreground mb-4">
              AI Search Optimization. Simplified.
            </p>
            <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
              <Link to="/resources" className="text-foreground font-medium">Resources</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Resources;