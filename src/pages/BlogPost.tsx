import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Tag, ArrowLeft, Search, Share2 } from 'lucide-react';
import { getBlogPost } from '@/data/blog-posts';
import { generateMetaTags, generateStructuredData, createBreadcrumbStructuredData } from '@/lib/seo';
import ReactMarkdown from 'react-markdown';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  
  if (!slug) {
    return <Navigate to="/resources" replace />;
  }

  const post = getBlogPost(slug);

  if (!post) {
    return <Navigate to="/resources" replace />;
  }

  const metaTags = generateMetaTags({
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    canonicalUrl: `/resources/${post.slug}`,
    ogType: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    articleSection: post.category,
    articleTags: post.tags
  });

  const articleStructuredData = generateStructuredData('Article', {
    headline: post.title,
    description: post.description,
    image: "https://llumos.ai/og-image.png",
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: `https://llumos.ai/resources/${post.slug}`
  });

  const breadcrumbData = createBreadcrumbStructuredData([
    { name: "Home", url: "/" },
    { name: "Resources", url: "/resources" },
    { name: post.title, url: `/resources/${post.slug}` }
  ]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.description,
          url: window.location.href
        });
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <Helmet>
        <title>{metaTags.title}</title>
        {metaTags.meta.map((tag, index) => (
          <meta key={index} {...tag} />
        ))}
        <script type="application/ld+json">
          {JSON.stringify(articleStructuredData)}
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

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
            <span>/</span>
            <span>{post.title}</span>
          </nav>

          {/* Back Button */}
          <div className="mb-8">
            <Button variant="ghost" asChild>
              <Link to="/resources" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Resources
              </Link>
            </Button>
          </div>

          {/* Article Header */}
          <article className="mb-16">
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
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
                <span>•</span>
                <Clock className="w-4 h-4" />
                <span>{post.readTime} min read</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                {post.title}
              </h1>
              
              <p className="text-xl text-muted-foreground mb-6">
                {post.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </header>

            {/* Article Content */}
            <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-primary prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-muted">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          </article>

          {/* CTA Section */}
          <Card className="p-8 bg-primary/5 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Apply These Strategies?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Start tracking your brand's AI search performance and implementing these proven tactics today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/auth">Start Free Trial</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/resources">Read More Articles</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              14-day free trial • No credit card required
            </p>
          </Card>
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

export default BlogPost;