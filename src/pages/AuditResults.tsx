import { useState } from 'react'; // Audit Results Page
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';
import { Logo } from '@/components/Logo';
import { 
  Search, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3, 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Eye,
  Sparkles,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Simulated audit data
const generateMockData = (domain: string) => {
  const score = Math.floor(Math.random() * 40) + 20; // 20-60 range (intentionally low to create urgency)
  return {
    domain,
    overallScore: score,
    platforms: {
      chatgpt: { mentioned: Math.random() > 0.6, score: Math.floor(Math.random() * 30) + 10 },
      gemini: { mentioned: Math.random() > 0.5, score: Math.floor(Math.random() * 40) + 15 },
      perplexity: { mentioned: Math.random() > 0.7, score: Math.floor(Math.random() * 25) + 5 },
    },
    competitors: ['Competitor A', 'Competitor B', 'Competitor C'],
    competitorMentions: Math.floor(Math.random() * 50) + 30,
    recommendations: [
      'Optimize your website content for AI crawlers',
      'Improve structured data markup',
      'Build more authoritative backlinks',
      'Create FAQ content targeting AI queries',
    ]
  };
};

const AuditResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const domain = searchParams.get('domain') || 'example.com';
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const data = generateMockData(domain);

  const handleUnlock = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Check your email for the full report!');
    
    // Redirect to signup with email pre-filled
    navigate(`/signup?email=${encodeURIComponent(email)}&from=audit`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Critical';
  };

  return (
    <>
      <SEOHelmet
        title={`AI Visibility Audit Results for ${domain}`}
        description="See how your brand appears in AI search results. Unlock your full AI visibility report."
        canonicalPath="/audit-results"
      />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Search className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold">Llumos</span>
            </Link>
            <nav className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Results Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2 border-primary/20">
              AI Visibility Audit Complete
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Audit Results for <span className="text-primary">{domain}</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Here's a preview of your brand's AI visibility performance
            </p>
          </motion.div>

          {/* Score Overview Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="mb-8 border-2 border-primary/20 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Overall AI Visibility Score
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <div className="text-center">
                    <div className={`text-6xl font-bold ${getScoreColor(data.overallScore)}`}>
                      {data.overallScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">out of 100</div>
                    <Badge 
                      variant="outline" 
                      className={`mt-2 ${data.overallScore < 40 ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'}`}
                    >
                      {data.overallScore < 40 ? <AlertTriangle className="w-3 h-3 mr-1" /> : null}
                      {getScoreLabel(data.overallScore)}
                    </Badge>
                  </div>
                  
                  <div className="h-24 w-px bg-border hidden md:block" />
                  
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-500">
                      {data.competitorMentions}%
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Competitor Mentions</div>
                    <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                      Your competitors are mentioned more often
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Platform Breakdown - Blurred */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mb-8"
          >
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Platform Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 blur-sm select-none pointer-events-none">
                  {Object.entries(data.platforms).map(([platform, info]) => (
                    <div key={platform} className="p-4 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium capitalize">{platform}</span>
                        {info.mentioned ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle className="w-3 h-3 mr-1" /> Mentioned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Not Found
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Visibility Score</span>
                          <span className="font-medium">{info.score}%</span>
                        </div>
                        <Progress value={info.score} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
          </motion.div>

          {/* Recommendations - Blurred */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative mb-12"
          >
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Personalized Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 blur-sm select-none pointer-events-none">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                      <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
          </motion.div>

          {/* Unlock CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 via-background to-secondary/10">
              <CardContent className="pt-8 pb-8">
                <div className="text-center max-w-lg mx-auto space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-2">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold">
                    Unlock Your Full AI Visibility Report
                  </h2>
                  
                  <p className="text-muted-foreground">
                    Get detailed platform breakdowns, competitor analysis, and actionable recommendations to improve your AI visibility.
                  </p>
                  
                  <ul className="text-left space-y-2 max-w-sm mx-auto">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Detailed platform-by-platform analysis
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Competitor mention comparison
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Personalized optimization tips
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      7-day free trial included
                    </li>
                  </ul>
                  
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-base"
                    />
                    <Button 
                      size="lg" 
                      className="h-12 px-6 font-semibold shadow-glow whitespace-nowrap"
                      onClick={handleUnlock}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Unlocking...' : 'Unlock Full Report'}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    No credit card required • Cancel anytime
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default AuditResults;
