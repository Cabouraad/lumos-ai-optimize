import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen, Search, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { getAllBlogPosts, getPostsByCategory } from '@/data/blog-posts';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SEOHelmet, structuredDataGenerators } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Case Studies', label: 'Case Studies' },
  { id: 'AI Optimization Guides', label: 'AI Optimization Guides' },
  { id: 'News', label: 'News' },
];

// Placeholder images for blog posts
const getPostImage = (index: number) => {
  const images = [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop',
  ];
  return images[index % images.length];
};

const NewsletterCard = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4 }}
    className="col-span-1"
  >
    <Card className="h-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-6 w-6" />
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-bold mb-2">
        Join 5,000+ Marketers Mastering AI Search
      </h3>
      <p className="text-primary-foreground/80 text-sm mb-4">
        Get weekly insights on AI visibility, optimization tips, and industry news delivered to your inbox.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter your email"
          className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60 flex-1"
        />
        <Button variant="secondary" size="sm" className="shrink-0">
          Subscribe
        </Button>
      </div>
      <p className="text-xs text-primary-foreground/60 mt-3">
        No spam. Unsubscribe anytime.
      </p>
    </Card>
  </motion.div>
);

interface BlogCardProps {
  post: {
    slug: string;
    title: string;
    description: string;
    category: string;
    publishedAt: string;
    readTime: number;
  };
  index: number;
}

const BlogCard = ({ post, index }: BlogCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.05 }}
  >
    <Link to={`/resources/${post.slug}`}>
      <Card className="group h-full overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/30">
        {/* Featured Image */}
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={getPostImage(index)}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        
        <div className="p-5">
          {/* Category Tag */}
          <Badge 
            variant="secondary" 
            className="mb-3 text-xs font-medium rounded-full px-3 py-1"
          >
            {post.category}
          </Badge>
          
          {/* Title */}
          <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          
          {/* Excerpt */}
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {post.description}
          </p>
          
          {/* Meta Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </time>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{post.readTime} min read</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  </motion.div>
);

const Resources = () => {
  const allPosts = getAllBlogPosts();
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') {
      return allPosts;
    }
    return getPostsByCategory(selectedCategory);
  }, [allPosts, selectedCategory]);

  // Signal to react-snap that the page is ready for prerendering
  useEffect(() => {
    if (typeof window !== 'undefined' && allPosts.length > 0) {
      // @ts-ignore - react-snap global
      window.snapSaveState = () => ({
        __PRELOADED_STATE__: { posts: allPosts }
      });
    }
  }, [allPosts]);
  
  // Insert newsletter card after 4th post
  const postsWithNewsletter = useMemo(() => {
    const result: (typeof filteredPosts[0] | 'newsletter')[] = [];
    filteredPosts.forEach((post, index) => {
      result.push(post);
      if (index === 3) {
        result.push('newsletter');
      }
    });
    // If less than 4 posts, add newsletter at end
    if (filteredPosts.length < 4 && filteredPosts.length > 0) {
      result.push('newsletter');
    }
    return result;
  }, [filteredPosts]);

  return (
    <>
      <SEOHelmet
        title="AI Search Marketing & GEO Guides | The Llumos Resource Hub"
        description="Master the new era of search. Read expert guides, case studies, and strategies for Generative Engine Optimization (GEO) and increasing brand visibility in LLMs."
        keywords="AI search marketing, GEO guides, Generative Engine Optimization, AI visibility strategies, LLM brand visibility"
        canonicalPath="/resources"
        structuredData={[
          structuredDataGenerators.website(),
          structuredDataGenerators.breadcrumb([
            { name: "Home", url: "/" },
            { name: "Resources", url: "/resources" }
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

        <main className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-center mb-4">
                <BookOpen className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                AI Search Resources & Insights
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Expert guides, case studies, and proven strategies to help you track and improve your brand visibility on AI-powered search engines.
              </p>
            </motion.div>
          </section>

          {/* Featured Article */}
          <section className="mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Link to="/blog/how-to-optimize-for-chatgpt-search">
                <Card className="group overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
                  <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <Badge variant="secondary" className="mb-2">Featured Guide</Badge>
                      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        How to Optimize for ChatGPT Search: The 2025 GEO Guide
                      </h2>
                      <p className="text-muted-foreground">
                        Learn the 5 core strategies of Generative Engine Optimization (GEO) to get cited by ChatGPT, Perplexity, and Gemini.
                      </p>
                    </div>
                    <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          </section>

          {/* Category Filter Tabs */}
          <section className="mb-10">
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full px-5"
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </section>

          {/* Posts Grid - 3 columns on desktop, 1 on mobile */}
          <section>
            <h2 className="sr-only">Articles</h2>
            
            {postsWithNewsletter.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {postsWithNewsletter.map((item, index) => {
                  if (item === 'newsletter') {
                    return <NewsletterCard key="newsletter" />;
                  }
                  return (
                    <BlogCard 
                      key={item.slug} 
                      post={item} 
                      index={index} 
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-6">
                  No articles in this category yet. Check back soon!
                </p>
                <Button variant="outline" onClick={() => setSelectedCategory('all')}>
                  View All Articles
                </Button>
              </div>
            )}
          </section>

          {/* CTA Section */}
          <section className="mt-20 text-center bg-card border border-border rounded-2xl p-12">
            <Badge variant="secondary" className="mb-4">Free Forever Plan</Badge>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Track Your AI Search Performance?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with our Free plan — track 5 prompts weekly on ChatGPT. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/signup" className="flex items-center gap-2">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/free-checker">Get Free Visibility Report</Link>
              </Button>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Resources;
