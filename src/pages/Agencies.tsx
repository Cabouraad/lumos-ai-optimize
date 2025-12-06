import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { SEOHelmet } from '@/components/SEOHelmet';
import { Footer } from '@/components/Footer';
import { 
  Search, 
  FileText, 
  Users, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle,
  DollarSign,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';

const Agencies = () => {
  const [clients, setClients] = useState(10);
  const [pricePerReport, setPricePerReport] = useState(200);
  
  const potentialRevenue = clients * pricePerReport;

  return (
    <>
      <SEOHelmet
        title="AI Visibility Reporting Tool for Marketing Agencies | Llumos"
        description="White-label AI visibility reports for your clients. The first AEO reporting tool built for marketing agencies. Grow your revenue with AI search services."
        keywords="agency AI reports, white-label SEO, AEO reporting, marketing agency tools, AI visibility for agencies"
        canonicalPath="/agencies"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Header */}
        <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Search className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-slate-900">Llumos</span>
            </Link>
            <nav className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup?plan=agency">Start Agency Trial</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20 md:py-32 px-4">
          <div className="container mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-2">
                <Building2 className="w-4 h-4 mr-2 inline" />
                Built for Agencies
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
                The First AEO Reporting Tool for Agencies
              </h1>
              
              <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto">
                Stop losing clients to AI. Offer AI Visibility services today.
              </p>
              
              <div className="pt-6">
                <Button 
                  size="lg" 
                  className="px-10 h-14 text-lg font-semibold shadow-lg"
                  asChild
                >
                  <Link to="/signup?plan=agency">
                    Start Agency Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Revenue Calculator */}
        <section className="py-20 px-4 bg-slate-100/50">
          <div className="container mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Calculate Your New Revenue
              </h2>
              <p className="text-lg text-slate-600">
                See how much you could earn by offering AI visibility reports to your clients
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 border-slate-200 shadow-xl bg-white">
                <CardContent className="p-8 space-y-8">
                  {/* Clients Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-lg font-medium text-slate-800">
                        Number of Clients
                      </label>
                      <span className="text-2xl font-bold text-primary">{clients}</span>
                    </div>
                    <Slider
                      value={[clients]}
                      onValueChange={(value) => setClients(value[0])}
                      min={1}
                      max={50}
                      step={1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>1</span>
                      <span>50</span>
                    </div>
                  </div>

                  {/* Price Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-lg font-medium text-slate-800">
                        Price you charge per report ($)
                      </label>
                      <span className="text-2xl font-bold text-primary">${pricePerReport}</span>
                    </div>
                    <Slider
                      value={[pricePerReport]}
                      onValueChange={(value) => setPricePerReport(value[0])}
                      min={50}
                      max={500}
                      step={25}
                      className="py-2"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>$50</span>
                      <span>$500</span>
                    </div>
                  </div>

                  {/* Revenue Output */}
                  <div className="pt-6 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-xl p-6 text-center">
                      <p className="text-slate-600 mb-2">Potential Monthly Revenue</p>
                      <div className="flex items-center justify-center gap-2">
                        <DollarSign className="w-8 h-8 text-primary" />
                        <span className="text-5xl md:text-6xl font-bold text-slate-900">
                          {potentialRevenue.toLocaleString()}
                        </span>
                        <span className="text-xl text-slate-500">/mo</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Everything You Need to Serve Clients
              </h2>
              <p className="text-lg text-slate-600">
                Professional tools built specifically for agency workflows
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <Card className="h-full border-2 border-slate-200 hover:border-primary/50 hover:shadow-xl transition-all duration-300 bg-white">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <FileText className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl text-slate-900">White-Label PDF Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">
                      Generate beautiful, branded reports with your agency logo. Impress clients with professional AI visibility insights.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full border-2 border-slate-200 hover:border-primary/50 hover:shadow-xl transition-all duration-300 bg-white">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl text-slate-900">Client Management Dashboard</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">
                      Manage all your clients from one central dashboard. Track their AI visibility across ChatGPT, Gemini, and Perplexity.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full border-2 border-slate-200 hover:border-primary/50 hover:shadow-xl transition-all duration-300 bg-white">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <TrendingUp className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl text-slate-900">Trend Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">
                      Show clients their progress over time. Historical data and trend charts prove the value of your AI optimization work.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Table */}
        <section className="py-20 px-4 bg-slate-100/50">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-slate-600">
                Choose the plan that fits your agency's needs
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Solo Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <Card className="h-full border-2 border-slate-200 bg-white">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl text-slate-900">Solo</CardTitle>
                    <p className="text-slate-600">For freelancers and consultants</p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="py-6">
                      <span className="text-5xl font-bold text-slate-900">$39</span>
                      <span className="text-slate-600">/month</span>
                    </div>
                    
                    <ul className="space-y-3 text-left mb-8">
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">Up to 3 client brands</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">100 AI prompts/month</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">PDF report exports</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">Email support</span>
                      </li>
                    </ul>
                    
                    <Button variant="outline" className="w-full h-12 text-lg" asChild>
                      <Link to="/signup?plan=solo">Get Started</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Agency Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full border-2 border-primary bg-white relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    Best Value
                  </div>
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl text-slate-900">Agency</CardTitle>
                    <p className="text-slate-600">For growing marketing agencies</p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="py-6">
                      <span className="text-5xl font-bold text-slate-900">$149</span>
                      <span className="text-slate-600">/month</span>
                    </div>
                    
                    <ul className="space-y-3 text-left mb-8">
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">Unlimited client brands</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">500 AI prompts/month</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700 font-medium">White-label reports</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700 font-medium">Team collaboration</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">Priority support</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-slate-700">API access</span>
                      </li>
                    </ul>
                    
                    <Button className="w-full h-12 text-lg shadow-lg" asChild>
                      <Link to="/signup?plan=agency">
                        Start Agency Trial
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Ready to Offer AI Visibility Services?
              </h2>
              <p className="text-lg text-slate-600">
                Join hundreds of agencies already using Llumos to serve their clients.
              </p>
              <Button 
                size="lg" 
                className="px-10 h-14 text-lg font-semibold shadow-lg"
                asChild
              >
                <Link to="/signup?plan=agency">
                  Start Your Agency Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default Agencies;
