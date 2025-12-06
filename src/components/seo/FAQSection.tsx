import { Helmet } from 'react-helmet-async';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs?: FAQItem[];
  title?: string;
  className?: string;
}

const defaultFAQs: FAQItem[] = [
  {
    question: "How is Llumos different from enterprise AI SEO tools like Profound or Conductor?",
    answer: "Llumos offers the same core AI visibility tracking at a fraction of the cost. While enterprise tools charge $500-1200/month, Llumos starts at $39/month. We focus specifically on AI search visibility across ChatGPT, Gemini, and Perplexity—without the bloated feature sets you'll never use."
  },
  {
    question: "What AI platforms does Llumos track?",
    answer: "Llumos monitors your brand visibility across all major AI platforms including ChatGPT, Google Gemini, Perplexity, Claude, and Google AI Overviews. We continuously add new platforms as they emerge in the AI search landscape."
  },
  {
    question: "How does Llumos collect AI visibility data?",
    answer: "We run real-time queries across AI platforms using prompts relevant to your industry and brand. Our system analyzes responses to determine how often your brand is mentioned, your prominence score, competitor mentions, and citation sources—giving you actionable insights to improve your AI presence."
  },
  {
    question: "Is there a free trial available?",
    answer: "Yes! Llumos offers a 7-day free trial on all plans. You can run your first AI visibility scan in under 2 minutes and see exactly how often AI tools recommend your brand versus competitors."
  },
  {
    question: "Can agencies use Llumos for multiple clients?",
    answer: "Absolutely. Our Agency plan supports multiple brands and clients under a single account. You get dedicated dashboards for each client, white-label reporting options, and priority support to help you deliver AI SEO services at scale."
  },
  {
    question: "What's included in the Llumos Score?",
    answer: "The Llumos Score is a composite metric that measures your overall AI visibility health. It factors in brand mention frequency, prominence position in AI responses, citation quality, competitor comparison, and trend trajectory across all tracked AI platforms."
  },
  {
    question: "How quickly can I see results after improving my AI visibility?",
    answer: "AI platforms update their training data and responses regularly. Most brands see measurable improvements within 2-4 weeks of implementing our recommendations. Llumos tracks changes daily so you can monitor progress in real-time."
  },
  {
    question: "Do you offer refunds if I'm not satisfied?",
    answer: "Yes, we offer a 30-day money-back guarantee on all paid plans. If Llumos doesn't deliver value for your AI SEO strategy, contact our support team for a full refund—no questions asked."
  }
];

const FAQSection = ({ 
  faqs = defaultFAQs, 
  title = "Frequently Asked Questions about AI SEO",
  className = ""
}: FAQSectionProps) => {
  // Generate FAQPage schema from the same data
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      
      <section className={`w-full max-w-4xl mx-auto ${className}`}>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-foreground">
          {title}
        </h2>
        
        <Accordion type="single" collapsible className="w-full space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`faq-${index}`}
              className="bg-card border border-border rounded-lg px-6 data-[state=open]:bg-accent/50 transition-colors"
            >
              <AccordionTrigger className="text-left text-base md:text-lg font-medium text-foreground hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base pb-5 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
};

export default FAQSection;
