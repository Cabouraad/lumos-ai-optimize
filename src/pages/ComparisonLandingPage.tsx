import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Check, X, Sparkles, ArrowRight, Zap, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { Footer } from '@/components/Footer';

// Competitor data configuration
interface CompetitorConfig {
  name: string;
  slug: string;
  tagline: string;
  features: {
    realTimeTracking: boolean | string;
    price: string;
    setupTime: string;
    citationAnalysis: boolean | string;
    whiteLabel: boolean | string;
    multiPlatform: boolean | string;
  };
  faqs: Array<{ question: string; answer: string }>;
}

// Competitor configurations - add more as needed
const competitors: Record<string, CompetitorConfig> = {
  'profound-ai': {
    name: 'Profound AI',
    slug: 'profound-ai',
    tagline: 'Enterprise-level features at a fraction of the cost',
    features: {
      realTimeTracking: 'Limited',
      price: '$500-1200/mo',
      setupTime: '2-3 weeks',
      citationAnalysis: false,
      whiteLabel: 'Enterprise only',
      multiPlatform: 'ChatGPT only',
    },
    faqs: [
      {
        question: 'Is Llumos really cheaper than Profound AI?',
        answer: 'Yes. Llumos starts at $39/month compared to Profound AI\'s $500-1200/month enterprise pricing. You get the same core AI visibility tracking without the enterprise markup.',
      },
      {
        question: 'Can I switch from Profound AI to Llumos easily?',
        answer: 'Absolutely. Most customers complete the switch in under 30 minutes. We provide a guided onboarding process and our team can help with any data migration needs.',
      },
      {
        question: 'Does Llumos track the same AI platforms as Profound AI?',
        answer: 'Llumos tracks more platforms including ChatGPT, Perplexity, Gemini, and Google AI Overviews. Profound AI primarily focuses on ChatGPT.',
      },
      {
        question: 'What features does Llumos have that Profound AI doesn\'t?',
        answer: 'Llumos offers citation analysis, competitor tracking, white-label reports (on Agency plans), and real-time monitoring across multiple AI platforms—all at a lower price point.',
      },
    ],
  },
  'conductor': {
    name: 'Conductor',
    slug: 'conductor',
    tagline: 'Modern AI visibility without the enterprise complexity',
    features: {
      realTimeTracking: 'Daily updates',
      price: '$600+/mo',
      setupTime: '1-2 weeks',
      citationAnalysis: 'Basic',
      whiteLabel: 'Enterprise only',
      multiPlatform: true,
    },
    faqs: [
      {
        question: 'How does Llumos compare to Conductor for AI visibility?',
        answer: 'While Conductor offers broad SEO capabilities, Llumos is purpose-built for AI search visibility. We provide deeper insights into how AI engines cite and recommend your brand.',
      },
      {
        question: 'Is Llumos suitable for enterprise teams?',
        answer: 'Yes. Llumos offers team features, API access, and white-label reports on higher tiers. Many enterprise teams choose Llumos for its focused AI visibility capabilities.',
      },
      {
        question: 'Can I use Llumos alongside Conductor?',
        answer: 'Absolutely. Many teams use traditional SEO tools like Conductor for organic search while adding Llumos specifically for AI search visibility tracking.',
      },
      {
        question: 'What\'s the main advantage of Llumos over Conductor?',
        answer: 'Llumos is built specifically for the AI search era. While Conductor retrofits AI features onto traditional SEO, Llumos was designed from the ground up for ChatGPT, Perplexity, and Gemini visibility.',
      },
    ],
  },
  // Default fallback
  'default': {
    name: 'Competitors',
    slug: 'default',
    tagline: 'The modern alternative for AI visibility tracking',
    features: {
      realTimeTracking: 'Varies',
      price: '$200-1000+/mo',
      setupTime: '1-4 weeks',
      citationAnalysis: 'Limited',
      whiteLabel: 'Enterprise only',
      multiPlatform: 'Limited',
    },
    faqs: [
      {
        question: 'Why should I choose Llumos over other AI visibility tools?',
        answer: 'Llumos offers the most comprehensive AI search tracking at the most accessible price point. We monitor ChatGPT, Perplexity, Gemini, and Google AI Overviews in one dashboard.',
      },
      {
        question: 'How quickly can I get started with Llumos?',
        answer: 'Most users are up and running within 5 minutes. Just enter your domain, and we\'ll start tracking your AI visibility immediately.',
      },
      {
        question: 'Does Llumos offer a free trial?',
        answer: 'Yes! We offer a 7-day free trial with full access to all features. No credit card required to start.',
      },
      {
        question: 'Can Llumos replace my current AI monitoring tool?',
        answer: 'In most cases, yes. Llumos provides comprehensive coverage of major AI platforms and offers features like citation analysis and competitor tracking that many alternatives lack.',
      },
    ],
  },
};

// Llumos features (always the same)
const llumosFeatures = {
  realTimeTracking: true,
  price: '$39/mo',
  setupTime: '5 minutes',
  citationAnalysis: true,
  whiteLabel: true,
  multiPlatform: true,
};

// Feature display component
const FeatureValue = ({ value }: { value: boolean | string }) => {
  if (value === true) {
    return <Check className="h-5 w-5 text-green-500 mx-auto" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-red-500 mx-auto" />;
  }
  return <span className="text-muted-foreground">{value}</span>;
};

// Generate FAQPage schema
const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map((faq) => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer,
    },
  })),
});

const ComparisonLandingPage = () => {
  const { competitor: competitorSlug } = useParams<{ competitor: string }>();
  const competitor = competitors[competitorSlug || ''] || competitors['default'];
  
  const pageTitle = `Llumos vs ${competitor.name}: The Modern Alternative for AI Visibility`;
  const metaDescription = `Compare Llumos against ${competitor.name}. Get the same data for 1/10th of the price. See the full feature breakdown and why marketers are switching.`;
  const canonicalUrl = `https://llumos.ai/vs/${competitor.slug}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content="Best AI Visibility Tools, Profound AI alternative, Brand monitoring for ChatGPT, Llumos vs Conductor, Cheap AEO tools" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        
        {/* FAQPage Schema */}
        <script type="application/ld+json">
          {JSON.stringify(generateFAQSchema(competitor.faqs))}
        </script>
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Llumos</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
            <Button asChild>
              <Link to="/signup">Start Free Trial</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="min-h-screen bg-background">
        
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              Comparison Guide
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Llumos vs. {competitor.name}:<br />
              <span className="text-primary">The Modern Alternative</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {competitor.tagline}. See why marketers are switching to Llumos for AI visibility tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/demo">Watch Demo</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* At a Glance Comparison Table */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">
              Feature Comparison at a Glance
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              See how Llumos stacks up against {competitor.name} in key areas that matter for AI visibility.
            </p>
            
            <div className="max-w-4xl mx-auto overflow-x-auto">
              <table className="w-full border-collapse bg-background rounded-lg overflow-hidden shadow-lg">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-6 font-semibold text-foreground">Feature</th>
                    <th className="py-4 px-6 font-semibold text-foreground bg-primary/10 border-x border-primary/20">
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Llumos
                      </div>
                    </th>
                    <th className="py-4 px-6 font-semibold text-foreground">{competitor.name}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-foreground">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        Real-time AI Tracking
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <FeatureValue value={llumosFeatures.realTimeTracking} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={competitor.features.realTimeTracking} />
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-foreground">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        Price
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <span className="font-bold text-primary">{llumosFeatures.price}</span>
                    </td>
                    <td className="py-4 px-6 text-center text-muted-foreground">
                      {competitor.features.price}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Setup Time
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <span className="font-medium text-green-600">{llumosFeatures.setupTime}</span>
                    </td>
                    <td className="py-4 px-6 text-center text-muted-foreground">
                      {competitor.features.setupTime}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-foreground">Citation Analysis</td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <FeatureValue value={llumosFeatures.citationAnalysis} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={competitor.features.citationAnalysis} />
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-foreground">White-Label Reports</td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <FeatureValue value={llumosFeatures.whiteLabel} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={competitor.features.whiteLabel} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 text-foreground">Multi-Platform Support</td>
                    <td className="py-4 px-6 text-center bg-primary/5 border-x border-primary/10">
                      <FeatureValue value={llumosFeatures.multiPlatform} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={competitor.features.multiPlatform} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Why Marketers Switch */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Why Marketers Switch to Llumos
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-lg text-muted-foreground mb-4">
                  The shift from traditional search to AI-powered discovery has caught many brands off guard. 
                  Enterprise tools like {competitor.name} were built for a different era—one where ranking in 
                  Google's blue links was the primary goal.
                </p>
                <p className="text-lg text-muted-foreground mb-4">
                  <strong className="text-foreground">Llumos was built for the AI search era.</strong> We 
                  understand that when someone asks ChatGPT "What's the best CRM for small businesses?" or 
                  queries Perplexity about marketing tools, your brand needs to be in that conversation.
                </p>
                <p className="text-lg text-muted-foreground mb-4">
                  Here's what marketers tell us after switching:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-foreground">10x faster setup</strong> — Start tracking in minutes, not weeks</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-foreground">90% cost savings</strong> — Get enterprise-level insights at startup prices</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-foreground">Multi-platform coverage</strong> — Track ChatGPT, Perplexity, Gemini, and Google AI Overviews</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-foreground">Actionable insights</strong> — Know exactly why AI engines recommend your competitors</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section with Schema */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Everything you need to know about switching from {competitor.name} to Llumos.
            </p>
            
            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {competitor.faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`faq-${index}`}
                    className="bg-background border border-border rounded-lg px-6"
                  >
                    <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Final Verdict */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  The Final Verdict
                </h2>
                <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                  If you're looking for comprehensive AI visibility tracking without the enterprise price tag, 
                  <strong className="text-foreground"> Llumos is the clear choice</strong>. Get started in minutes, 
                  track across all major AI platforms, and pay 90% less than alternatives like {competitor.name}.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild>
                    <Link to="/signup">
                      Start Your Free 7-Day Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/pricing">Compare Pricing</Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  No credit card required • Setup in under 5 minutes
                </p>
              </div>
            </Card>
          </div>
        </section>

      </div>

      <Footer />
    </>
  );
};

export default ComparisonLandingPage;
