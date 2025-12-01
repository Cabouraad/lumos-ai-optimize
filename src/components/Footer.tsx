import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-card/50 backdrop-blur">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">Llumos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Track and optimize your brand visibility across AI-powered search engines like ChatGPT, Gemini, and Perplexity.
            </p>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <nav className="space-y-3">
              <Link to="/features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link to="/pricing" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link to="/demo" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Watch Demo
              </Link>
              <Link to="/free-checker" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Free Llumos Score Checker
              </Link>
            </nav>
          </div>

          {/* Features Column */}
          <div>
            <h3 className="font-semibold mb-4">Features</h3>
            <nav className="space-y-3">
              <Link to="/features/brand-visibility" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Brand Visibility Tracking
              </Link>
              <Link to="/features/competitive-analysis" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Competitive Analysis
              </Link>
              <Link to="/features/actionable-recommendations" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                AI Recommendations
              </Link>
            </nav>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <nav className="space-y-3">
              <Link to="/resources" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Blog & Guides
              </Link>
              <Link to="/user-guide" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                User Guide
              </Link>
              <a 
                href="https://openai.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ChatGPT
              </a>
              <a 
                href="https://www.perplexity.ai" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Perplexity AI
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Llumos. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
