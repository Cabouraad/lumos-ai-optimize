import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowLeft, Search, Share2, ArrowRight } from 'lucide-react';
import { getBlogPost, getAllBlogPosts } from '@/data/blog-posts';
import { generateMetaTags, generateStructuredData, createBreadcrumbStructuredData } from '@/lib/seo';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

// Get related posts image
const getPostImage = (index: number) => {
  const images = [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&h=400&fit=crop',
  ];
  return images[index % images.length];
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  
  if (!slug) {
    return <Navigate to="/resources" replace />;
  }

  const post = getBlogPost(slug);
  const allPosts = getAllBlogPosts();
  
  // Get related posts (same category, excluding current)
  const relatedPosts = allPosts
    .filter(p => p.category === post?.category && p.slug !== slug)
    .slice(0, 3);

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
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
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
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px]">{post.title}</span>
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

          {/* Article */}
          <article>
            {/* Article Header */}
            <header className="mb-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Category Badge */}
                <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1">
                  {post.category}
                </Badge>
                
                {/* H1 Title - Critical for SEO */}
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>
                
                {/* Description */}
                <p className="text-xl text-muted-foreground mb-6">
                  {post.description}
                </p>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{post.readTime} min read</span>
                  </div>
                </div>

                {/* Tags & Share */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className="bg-muted text-muted-foreground text-sm px-3 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </div>
              </motion.div>
            </header>

            {/* Article Content - H2 subheaders for SEO */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="prose prose-lg max-w-none 
                prose-headings:text-foreground 
                prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-5
                prose-strong:text-foreground prose-strong:font-semibold
                prose-li:text-foreground prose-li:leading-relaxed
                prose-ul:my-4 prose-ol:my-4
                prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary prose-blockquote:italic
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:text-primary prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                prose-pre:bg-muted prose-pre:rounded-lg"
            >
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </motion.div>
          </article>

          {/* Related Articles */}
          {relatedPosts.length > 0 && (
            <section className="mt-16 pt-12 border-t">
              <h2 className="text-2xl font-bold text-foreground mb-8">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost, index) => (
                  <Link key={relatedPost.slug} to={`/resources/${relatedPost.slug}`}>
                    <Card className="group h-full overflow-hidden hover:shadow-lg transition-all duration-300">
                      <div className="aspect-[16/10] overflow-hidden bg-muted">
                        <img
                          src={getPostImage(index)}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-2 text-xs rounded-full">
                          {relatedPost.category}
                        </Badge>
                        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {relatedPost.title}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          <span>{relatedPost.readTime} min read</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA Section */}
          <Card className="mt-16 p-8 bg-primary/5 border-primary/20 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Apply These Strategies?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Start tracking your brand's AI search performance and implementing these proven tactics today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/signup" className="flex items-center gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/resources">Read More Articles</Link>
              </Button>
            </div>
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
              <Link to="/signin" className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default BlogPost;
