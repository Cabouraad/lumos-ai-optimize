import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';
import { 
  Search, 
  Zap, 
  Eye, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Dummy traffic source trend data
const trafficData = [
  { month: 'Jan', ChatGPT: 42, Perplexity: 18 },
  { month: 'Feb', ChatGPT: 48, Perplexity: 22 },
  { month: 'Mar', ChatGPT: 51, Perplexity: 28 },
  { month: 'Apr', ChatGPT: 54, Perplexity: 35 },
  { month: 'May', ChatGPT: 58, Perplexity: 42 },
  { month: 'Jun', ChatGPT: 62, Perplexity: 51 },
];

const ChatGPTvsPerplexity = () => {
  return (
    <>
      <SEOHelmet
        title="ChatGPT vs Perplexity for Brands: Which AI Search Engine is Better?"
        description="Compare ChatGPT and Perplexity side-by-side. Learn which AI platform is best for your brand visibility and how to optimize for both."
        keywords="ChatGPT vs Perplexity, AI search comparison, brand visibility AI, ChatGPT for brands, Perplexity for brands"
        canonicalPath="/compare/chatgpt-vs-perplexity"
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

        {/* Hero */}
        <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
          <div className="container mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Badge variant="outline" className="px-4 py-2 border-primary/20">
                <TrendingUp className="w-4 h-4 mr-2 inline" />
                AI Search Comparison
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                AI Search Wars:<br />
                <span className="text-primary">ChatGPT</span> vs <span className="text-purple-600">Perplexity</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Which AI platform is recommending your brand? Understand the key differences and optimize your visibility on both.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Split Comparison */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-8">
              {/* ChatGPT Column */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                      <Zap className="w-10 h-10 text-primary" />
                    </div>
                    <CardTitle className="text-3xl text-primary">ChatGPT</CardTitle>
                    <p className="text-muted-foreground">by OpenAI</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Market Share */}
                    <div className="text-center p-4 rounded-lg bg-background/50 border">
                      <p className="text-sm text-muted-foreground mb-1">Market Share</p>
                      <p className="text-4xl font-bold text-primary">62%</p>
                      <p className="text-xs text-muted-foreground">of AI search traffic</p>
                    </div>

                    {/* Strengths */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Strengths
                      </h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Largest user base with 200M+ weekly active users</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Deep integration with Microsoft ecosystem</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Advanced reasoning with GPT-4 and plugins</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Brand mentions often lead to direct traffic</span>
                        </li>
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-500" />
                        Weaknesses
                      </h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>No direct citations or source links in base model</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>Knowledge cutoff limits real-time accuracy</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>Can hallucinate brand information</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Perplexity Column */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4">
                      <Eye className="w-10 h-10 text-purple-600" />
                    </div>
                    <CardTitle className="text-3xl text-purple-600">Perplexity</CardTitle>
                    <p className="text-muted-foreground">AI Answer Engine</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Market Share */}
                    <div className="text-center p-4 rounded-lg bg-background/50 border">
                      <p className="text-sm text-muted-foreground mb-1">Market Share</p>
                      <p className="text-4xl font-bold text-purple-600">18%</p>
                      <p className="text-xs text-muted-foreground">of AI search traffic</p>
                    </div>

                    {/* Strengths */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Strengths
                      </h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Always provides source citations with links</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Real-time web search for up-to-date info</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Faster growing user base (+340% YoY)</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Citations drive direct referral traffic</span>
                        </li>
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-500" />
                        Weaknesses
                      </h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>Smaller user base compared to ChatGPT</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>Less brand recognition among consumers</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>Limited enterprise integrations</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Traffic Trends Chart */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Traffic Source Trends</h2>
              <p className="text-muted-foreground">Referral traffic from AI platforms (% of total AI search traffic)</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={trafficData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-sm" />
                      <YAxis className="text-sm" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend />
                      <Bar 
                        dataKey="ChatGPT" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                        name="ChatGPT"
                      />
                      <Bar 
                        dataKey="Perplexity" 
                        fill="#9333ea" 
                        radius={[4, 4, 0, 0]} 
                        name="Perplexity"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 via-background to-purple-500/10 overflow-hidden">
                <CardContent className="p-8 md:p-12 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Which one favors <span className="text-primary">YOUR</span> brand?
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Stop guessing. See exactly how ChatGPT and Perplexity talk about your brand with a side-by-side AI visibility analysis.
                  </p>
                  <Button 
                    size="lg" 
                    className="px-10 h-14 text-lg font-semibold shadow-glow"
                    asChild
                  >
                    <Link to="/">
                      Run a Side-by-Side Comparison for Free
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Takes less than 2 minutes • No credit card required
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default ChatGPTvsPerplexity;
