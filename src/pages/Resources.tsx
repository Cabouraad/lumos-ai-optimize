import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Tag, BookOpen, TrendingUp, Search, Filter, X } from 'lucide-react';
import { getAllBlogPosts, getFeaturedPosts, getAllCategories, getAllTags, getPostsByCategory, getPostsByTag } from '@/data/blog-posts';
import { generateMetaTags, generateStructuredData, createBreadcrumbStructuredData } from '@/lib/seo';
import { useState, useMemo } from 'react';

const Resources = () => {
  const allPosts = getAllBlogPosts();
  const featuredPosts = getFeaturedPosts();
  const categories = getAllCategories();
  const tags = getAllTags();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Filter posts based on search, category, and tags
  const filteredPosts = useMemo(() => {
    let filtered = allPosts;
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        post.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = getPostsByCategory(selectedCategory);
      
      // Apply search to category results
      if (searchQuery) {
        filtered = filtered.filter(post =>
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
    }
    
    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(post =>
        selectedTags.every(tag => post.tags.includes(tag))
      );
    }
    
    return filtered;
  }, [allPosts, searchQuery, selectedCategory, selectedTags]);
  
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTags([]);
  };
  
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

        <main className="container mx-auto px-4 py-12 max-w-7xl">
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
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground mb-8">
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
            
            {/* Search and Filter Section */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search resources, guides, and insights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
              
              {/* Active Filters */}
              {(selectedTags.length > 0 || selectedCategory !== 'all' || searchQuery) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      Search: "{searchQuery}"
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                    </Badge>
                  )}
                  {selectedCategory !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedCategory}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('all')} />
                    </Badge>
                  )}
                  {selectedTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleTag(tag)} />
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Featured Posts */}
          {featuredPosts.length > 0 && !searchQuery && selectedCategory === 'all' && selectedTags.length === 0 && (
            <section className="mb-16">
              <h2 className="text-3xl font-bold text-foreground mb-8">Featured Articles</h2>
              <div className="grid lg:grid-cols-2 gap-8">
                {featuredPosts.map((post) => (
                  <Card key={post.slug} className="group p-8 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-background to-background/50 border-2 hover:border-primary/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Badge variant="secondary" className="text-xs">Featured</Badge>
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
                    <h3 className="text-2xl font-semibold text-foreground mb-4 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground mb-6 line-clamp-3">
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {post.readTime} min read
                        </span>
                      </div>
                      <Button asChild className="group-hover:shadow-lg">
                        <Link to={`/resources/${post.slug}`}>Read Article</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Content Organization */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-foreground">
                {searchQuery || selectedCategory !== 'all' || selectedTags.length > 0 
                  ? `${filteredPosts.length} Resource${filteredPosts.length !== 1 ? 's' : ''} Found`
                  : 'All Resources'
                }
              </h2>
              <div className="text-sm text-muted-foreground">
                {allPosts.length} total articles
              </div>
            </div>
            
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-6">
                <TabsTrigger value="all" className="text-xs lg:text-sm">All</TabsTrigger>
                {categories.slice(0, 5).map(category => (
                  <TabsTrigger key={category} value={category} className="text-xs lg:text-sm">
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            {/* Tag Filter */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Filter by tags:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            {/* Posts Grid */}
            {filteredPosts.length > 0 ? (
              <div className="grid gap-6">
                {filteredPosts.map((post) => (
                  <Card key={post.slug} className="group p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/20">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Badge variant="outline" className="text-xs">{post.category}</Badge>
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
                        <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                          {post.title}
                        </h3>
                        <p className="text-muted-foreground mb-4 line-clamp-2">
                          {post.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary/20"
                              onClick={() => toggleTag(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button asChild className="group-hover:shadow-md">
                          <Link to={`/resources/${post.slug}`}>Read More</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No resources found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
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
                <Link to="/auth">Put Insights Into Action - Start Free Trial</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/free-checker">Get Free Visibility Report</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              7-day free trial • Payment method required • No charge until trial ends • Cancel anytime
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