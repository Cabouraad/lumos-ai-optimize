import { motion } from 'framer-motion';
import { Check, X, Sparkles, BadgeCheck, Zap, Calendar, FileText, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SEOHelmet } from '@/components/SEOHelmet';

const comparisonData = [
  {
    feature: 'Price',
    icon: DollarSign,
    llumos: '$39/mo',
    competitor: '$500+/mo',
    llumosWin: true,
  },
  {
    feature: 'Setup Time',
    icon: Zap,
    llumos: 'Instant',
    competitor: 'Weeks',
    llumosWin: true,
  },
  {
    feature: 'Actionable Insights',
    icon: FileText,
    llumos: 'Step-by-step Guides',
    competitor: 'Raw Data Only',
    llumosWin: true,
    llumosCheck: true,
    competitorCross: true,
  },
  {
    feature: 'Contract',
    icon: Calendar,
    llumos: 'Monthly/Cancel Anytime',
    competitor: 'Annual Lock-in',
    llumosWin: true,
  },
];

const ComparisonPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEOHelmet
        title="Llumos vs Enterprise Tools | AI Visibility Comparison"
        description="See why marketers choose Llumos over expensive enterprise AI visibility tools. Compare features, pricing, and setup time."
        keywords="AI visibility, brand monitoring, competitor analysis, marketing tools"
      />

      <div className="min-h-screen bg-background">
        {/* Header Section */}
        <section className="relative py-16 md:py-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative max-w-4xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Compare & Save
            </span>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Why Marketers Choose Llumos Over{' '}
              <span className="text-primary">Enterprise Tools</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get the same insights as $500+/mo tools at a fraction of the cost. No contracts, no complexity.
            </p>
          </motion.div>
        </section>

        {/* Comparison Table Section */}
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-2xl overflow-hidden border border-border bg-card shadow-xl"
            >
              {/* Table Header */}
              <div className="grid grid-cols-3 bg-muted/50">
                <div className="p-4 md:p-6 font-semibold text-foreground">
                  Feature
                </div>
                <div className="p-4 md:p-6 text-center relative">
                  {/* Best Value Badge */}
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
                      <BadgeCheck className="h-3 w-3" />
                      Best Value
                    </span>
                  </div>
                  <div className="pt-2">
                    <span className="font-bold text-primary text-lg">Llumos</span>
                  </div>
                </div>
                <div className="p-4 md:p-6 text-center">
                  <span className="font-semibold text-muted-foreground">Legacy Enterprise</span>
                </div>
              </div>

              {/* Table Rows */}
              {comparisonData.map((row, index) => (
                <motion.div
                  key={row.feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className={`grid grid-cols-3 ${
                    index !== comparisonData.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  {/* Feature Name */}
                  <div className="p-4 md:p-6 flex items-center gap-3">
                    <row.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground">{row.feature}</span>
                  </div>

                  {/* Llumos Column - Highlighted */}
                  <div className="p-4 md:p-6 text-center bg-primary/5 border-x border-primary/20">
                    <div className="flex items-center justify-center gap-2">
                      {row.llumosCheck ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="h-4 w-4 text-green-500" />
                          </div>
                          <span className="text-foreground font-medium text-sm md:text-base">{row.llumos}</span>
                        </div>
                      ) : (
                        <span className="text-primary font-semibold text-sm md:text-base">{row.llumos}</span>
                      )}
                    </div>
                  </div>

                  {/* Competitor Column */}
                  <div className="p-4 md:p-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {row.competitorCross ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-muted-foreground text-sm md:text-base">{row.competitor}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm md:text-base">{row.competitor}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Bottom Summary */}
              <div className="p-6 bg-primary/5 border-t border-primary/20">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">
                    <span className="font-bold text-foreground">Save over $5,500/year</span> by switching to Llumos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Same AI visibility insights. Fraction of the price.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Additional Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  title: 'No Long-Term Contracts',
                  description: 'Cancel anytime. Your data stays yours.',
                },
                {
                  title: 'Setup in Minutes',
                  description: 'Start tracking AI visibility instantly.',
                },
                {
                  title: 'Dedicated Support',
                  description: 'Get help when you need it, no extra cost.',
                },
              ].map((benefit, index) => (
                <div
                  key={benefit.title}
                  className="p-6 rounded-xl bg-card border border-border text-center"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Spacer for sticky CTA */}
        <div className="h-24" />

        {/* Sticky CTA Bar */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border shadow-2xl z-50"
        >
          <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="font-bold text-foreground text-lg">
                Stop Overpaying. Start Tracking for Free.
              </p>
              <p className="text-sm text-muted-foreground">
                7-day free trial. No credit card required.
              </p>
            </div>
            <Button
              onClick={() => navigate('/signup')}
              size="lg"
              className="px-8 font-semibold shadow-lg shadow-primary/25"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start Trial
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default ComparisonPage;
