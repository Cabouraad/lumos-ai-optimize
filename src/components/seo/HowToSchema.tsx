import { Helmet } from 'react-helmet-async';

interface HowToStep {
  name: string;
  text: string;
  imageUrl?: string;
}

interface HowToSchemaProps {
  /** The title/name of the how-to guide */
  title: string;
  /** Short description/summary of the guide */
  description: string;
  /** Array of steps for the how-to process */
  steps: HowToStep[];
  /** Total time to complete (ISO 8601 duration format, e.g., 'PT2M' for 2 minutes) */
  totalTime?: string;
  /** Tool required to complete the how-to */
  tool?: string;
  /** Estimated cost (set to '0' for free) */
  estimatedCost?: string;
  /** Currency for the cost */
  currency?: string;
  /** Main image for the how-to */
  image?: string;
  /** Canonical URL of the how-to page */
  url?: string;
}

/**
 * HowToSchema Component
 * 
 * Generates JSON-LD structured data for HowTo schema.
 * This helps Google understand step-by-step guides and can enable:
 * - Rich snippets with numbered steps in search results
 * - How-to carousels in Google Search
 * - Voice assistant integration for step-by-step guidance
 * 
 * @see https://schema.org/HowTo
 * @see https://developers.google.com/search/docs/appearance/structured-data/how-to
 * 
 * @example
 * ```tsx
 * const steps = [
 *   { name: 'Step 1', text: 'Enter your domain', imageUrl: '/step1.png' },
 *   { name: 'Step 2', text: 'Wait for analysis', imageUrl: '/step2.png' },
 *   { name: 'Step 3', text: 'Review your score', imageUrl: '/step3.png' },
 * ];
 * 
 * <HowToSchema 
 *   title="How to Check Your AI Visibility Score" 
 *   description="Learn how to check your brand's visibility across AI search engines"
 *   steps={steps} 
 * />
 * ```
 */
export const HowToSchema = ({
  title,
  description,
  steps,
  totalTime = 'PT2M',
  tool = 'Llumos AI Visibility Checker',
  estimatedCost = '0',
  currency = 'USD',
  image = 'https://llumos.ai/og-home.png',
  url,
}: HowToSchemaProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": title,
    "description": description,
    "image": image,
    ...(url && { "url": url }),
    "totalTime": totalTime,
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": currency,
      "value": estimatedCost
    },
    "tool": {
      "@type": "HowToTool",
      "name": tool
    },
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      ...(step.imageUrl && {
        "image": {
          "@type": "ImageObject",
          "url": step.imageUrl
        }
      })
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

// Pre-built HowTo schemas for common Llumos use cases

/**
 * Pre-configured HowTo schema for checking AI visibility score
 */
export const CheckAIScoreHowTo = () => {
  const steps: HowToStep[] = [
    {
      name: 'Enter your domain',
      text: 'Navigate to the Llumos homepage and enter your website domain in the AI Score Checker tool.',
      imageUrl: 'https://llumos.ai/howto/step1-enter-domain.png'
    },
    {
      name: 'Wait for AI analysis',
      text: 'Llumos queries multiple AI platforms including ChatGPT, Perplexity, and Gemini to analyze your brand visibility.',
      imageUrl: 'https://llumos.ai/howto/step2-analysis.png'
    },
    {
      name: 'Review your visibility score',
      text: 'View your AI visibility score and see how often AI search engines recommend your brand vs competitors.',
      imageUrl: 'https://llumos.ai/howto/step3-results.png'
    }
  ];

  return (
    <HowToSchema
      title="How to Check Your AI Visibility Score"
      description="Learn how to check your brand's visibility across AI-powered search engines like ChatGPT, Perplexity, and Gemini in under 2 minutes."
      steps={steps}
      totalTime="PT2M"
      url="https://llumos.ai"
    />
  );
};

/**
 * Pre-configured HowTo schema for improving AI visibility
 */
export const ImproveAIVisibilityHowTo = () => {
  const steps: HowToStep[] = [
    {
      name: 'Audit your current AI visibility',
      text: 'Use Llumos to scan how often AI engines mention your brand and identify visibility gaps.',
    },
    {
      name: 'Analyze competitor performance',
      text: 'Review which competitors are being recommended by AI platforms and understand why.',
    },
    {
      name: 'Implement GEO optimizations',
      text: 'Follow Llumos recommendations to optimize your content for AI search engines.',
    },
    {
      name: 'Track your progress',
      text: 'Monitor your AI visibility score over time to measure improvement.',
    }
  ];

  return (
    <HowToSchema
      title="How to Improve Your Brand's AI Search Visibility"
      description="A step-by-step guide to increasing your brand's visibility in AI-powered search engines like ChatGPT and Perplexity."
      steps={steps}
      totalTime="PT30M"
      url="https://llumos.ai/resources"
    />
  );
};

/**
 * Pre-configured HowTo schema for setting up Llumos
 */
export const SetupLlumosHowTo = () => {
  const steps: HowToStep[] = [
    {
      name: 'Create your free account',
      text: 'Sign up for Llumos using your email address. No credit card required for the 7-day trial.',
    },
    {
      name: 'Add your brand domain',
      text: 'Enter your website domain and business description to help Llumos understand your brand.',
    },
    {
      name: 'Select tracking prompts',
      text: 'Choose from AI-suggested prompts or add custom queries you want to monitor.',
    },
    {
      name: 'Run your first visibility scan',
      text: 'Launch your first AI visibility scan to see how your brand performs across AI platforms.',
    },
    {
      name: 'Review your dashboard',
      text: 'Access your personalized dashboard to track visibility scores, competitors, and optimization recommendations.',
    }
  ];

  return (
    <HowToSchema
      title="How to Set Up Llumos for AI Visibility Tracking"
      description="Complete guide to setting up your Llumos account and running your first AI visibility scan in under 5 minutes."
      steps={steps}
      totalTime="PT5M"
      tool="Llumos Platform"
      url="https://llumos.ai/signup"
    />
  );
};

export default HowToSchema;
