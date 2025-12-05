import { useParams, Navigate, Link } from "react-router-dom";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Check, MessageSquare, TrendingUp, BarChart3, Users, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

interface IndustryData {
  name: string;
  slug: string;
  headline: string;
  painPoint: string;
  description: string;
  seoDescription: string;
  focusArea: string;
  chatExample: {
    question: string;
    competitors: string[];
  };
  benefits: string[];
  useCases: string[];
}

const industryData: Record<string, IndustryData> = {
  saas: {
    name: "SaaS",
    slug: "saas",
    headline: "AI Visibility Tracking for SaaS Brands",
    painPoint: "Is ChatGPT recommending your SaaS competitors?",
    description: "Track how often AI platforms recommend your B2B software in comparisons, reviews, and buying decisions.",
    seoDescription: "Stop losing deals to competitors in AI search. Track your SaaS brand visibility in ChatGPT, Gemini, and Perplexity. Get actionable insights to improve your AI search presence.",
    focusArea: "B2B software comparisons",
    chatExample: {
      question: "What's the best CRM software for startups?",
      competitors: ["HubSpot", "Salesforce", "Pipedrive", "Zoho CRM"],
    },
    benefits: [
      "Track visibility in software comparison queries",
      "Monitor competitor mentions in AI recommendations",
      "Optimize content for AI search algorithms",
      "Measure ROI of content marketing efforts",
    ],
    useCases: [
      "Product comparison queries",
      "Alternative to [competitor] searches",
      "Best software for [use case] questions",
      "Industry-specific tool recommendations",
    ],
  },
  ecommerce: {
    name: "E-commerce",
    slug: "ecommerce",
    headline: "AI Visibility Tracking for E-commerce Brands",
    painPoint: "Is ChatGPT recommending your e-commerce competitors?",
    description: "Track how often AI platforms recommend your products when shoppers ask for buying advice.",
    seoDescription: "Capture more sales by appearing in AI product recommendations. Track your e-commerce brand visibility in ChatGPT, Gemini, and Perplexity.",
    focusArea: "Product recommendations",
    chatExample: {
      question: "What are the best running shoes for beginners?",
      competitors: ["Nike", "Brooks", "ASICS", "New Balance"],
    },
    benefits: [
      "Track visibility in product recommendation queries",
      "Monitor which products AI suggests to shoppers",
      "Optimize product descriptions for AI discovery",
      "Increase organic AI-driven traffic",
    ],
    useCases: [
      "Best [product] for [audience] queries",
      "Product comparison shopping",
      "Gift recommendation searches",
      "Category-specific buying guides",
    ],
  },
  agencies: {
    name: "Agencies",
    slug: "agencies",
    headline: "AI Visibility Tracking for Marketing Agencies",
    painPoint: "Are your clients invisible in AI search results?",
    description: "White-label AI visibility tracking and reporting to help your clients dominate AI search platforms.",
    seoDescription: "Offer AI search visibility tracking as a service. Help your agency clients appear in ChatGPT, Gemini, and Perplexity recommendations with actionable reporting.",
    focusArea: "Client reporting",
    chatExample: {
      question: "What's the best digital marketing agency in NYC?",
      competitors: ["WebFX", "Ignite Visibility", "Thrive Agency", "Disruptive Advertising"],
    },
    benefits: [
      "White-label reports for client presentations",
      "Multi-brand tracking in one dashboard",
      "Competitor benchmarking across industries",
      "Prove AI search ROI to clients",
    ],
    useCases: [
      "Monthly AI visibility reports",
      "Competitor gap analysis",
      "Content strategy recommendations",
      "AI search optimization services",
    ],
  },
};

const IndustryLandingPage = () => {
  const { industry } = useParams<{ industry: string }>();
  
  const data = industry ? industryData[industry.toLowerCase()] : null;
  
  if (!data) {
    return <Navigate to="/" replace />;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `AI Search Optimization (GEO) for ${data.name} Companies | Llumos`,
    "description": data.seoDescription,
    "url": `https://llumos.app/solutions/${data.slug}`,
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Llumos",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": data.description,
    },
  };

  return (
    <>
      <SEOHelmet
        title={`AI Search Optimization (GEO) for ${data.name} Companies`}
        description={data.seoDescription}
        canonicalPath={`/solutions/${data.slug}`}
        structuredData={structuredData}
      />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/30 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Logo collapsed={false} />
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Home
                </Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </div>
        </header>
        
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block px-3 py-1 mb-4 text-sm font-medium bg-primary/10 text-primary rounded-full">
                  For {data.name} Brands
                </span>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                  {data.headline}
                </h1>
                <p className="text-xl text-muted-foreground mb-8">
                  {data.description}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="text-lg">
                    <Link to="/signup">Start Free Trial</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg">
                    <Link to="/demo">Watch Demo</Link>
                  </Button>
                </div>
              </div>
              
              {/* Chat Example Graphic */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">ChatGPT</span>
                </div>
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">User</p>
                    <p className="text-foreground">{data.chatExample.question}</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">ChatGPT</p>
                    <p className="text-foreground mb-3">Here are some top recommendations:</p>
                    <ul className="space-y-2">
                      {data.chatExample.competitors.map((competitor, index) => (
                        <li key={index} className="flex items-center gap-2 text-foreground">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          {competitor}
                        </li>
                      ))}
                      <li className="flex items-center gap-2 text-primary font-medium">
                        <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                          ?
                        </span>
                        Is YOUR brand here?
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Point Section */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              {data.painPoint}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Every day, millions of people ask AI platforms for {data.focusArea.toLowerCase()}. 
              If your brand isn't being recommended, you're losing customers to competitors who are.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-card p-6 rounded-xl border border-border">
                <TrendingUp className="h-10 w-10 text-primary mb-4 mx-auto" />
                <h3 className="font-semibold text-foreground mb-2">Track Visibility</h3>
                <p className="text-muted-foreground text-sm">
                  Monitor how often AI platforms mention your brand vs competitors.
                </p>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border">
                <BarChart3 className="h-10 w-10 text-primary mb-4 mx-auto" />
                <h3 className="font-semibold text-foreground mb-2">Measure Impact</h3>
                <p className="text-muted-foreground text-sm">
                  Get actionable insights to improve your AI search presence.
                </p>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border">
                <Users className="h-10 w-10 text-primary mb-4 mx-auto" />
                <h3 className="font-semibold text-foreground mb-2">Beat Competitors</h3>
                <p className="text-muted-foreground text-sm">
                  See which competitors dominate and how to outrank them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">
                  Built for {data.name} Success
                </h2>
                <ul className="space-y-4">
                  {data.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">
                  Track These {data.name} Queries
                </h2>
                <ul className="space-y-4">
                  {data.useCases.map((useCase, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{useCase}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-primary/5">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Start Tracking Your {data.name} Brand Today
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join hundreds of {data.name.toLowerCase()} brands already using Llumos to dominate AI search.
            </p>
            <Button asChild size="lg" className="text-lg">
              <Link to="/signup">Start Your Free Trial</Link>
            </Button>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default IndustryLandingPage;
