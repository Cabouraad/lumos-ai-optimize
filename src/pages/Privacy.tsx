import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from 'lucide-react';
import { SEOHelmet } from '@/components/SEOHelmet';

export default function Privacy() {
  return (
    <>
      <SEOHelmet
        title="Privacy Policy"
        description="Learn how Llumos collects, uses, and protects your data. Our privacy policy explains our data practices for AI search visibility tracking."
        keywords="Llumos privacy policy, data protection, privacy, GDPR, data security"
        canonicalPath="/privacy"
      />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-display font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg max-w-none text-foreground">
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Information We Collect</h2>
            <p className="mb-4 text-foreground">
              When you use our Free Brand Visibility Checker, we collect the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li><strong>Contact Information:</strong> Email address and company domain</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our service</li>
              <li><strong>Technical Data:</strong> IP address, browser type, and device information</li>
              <li><strong>Analysis Results:</strong> AI platform responses and visibility scores generated for your brand</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. How We Use Your Information</h2>
            <p className="mb-4 text-foreground">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Provide you with AI visibility analysis and reports</li>
              <li>Send you your requested analysis results via email</li>
              <li>Improve our services and develop new features</li>
              <li>Communicate with you about our services (with your consent)</li>
              <li>Comply with legal obligations and protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Information Sharing</h2>
            <p className="mb-4 text-foreground">
              We do not sell, trade, or otherwise transfer your personal information to third parties, except:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li><strong>Service Providers:</strong> We work with trusted third-party services (like email providers) to deliver our services</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Data Security</h2>
            <p className="mb-4 text-foreground">
              We implement appropriate security measures to protect your personal information, including:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication measures</li>
              <li>Secure data processing and storage practices</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Data Retention</h2>
            <p className="mb-4 text-foreground">
              We retain your personal information only as long as necessary to:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Provide you with our services</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce our agreements</li>
            </ul>
            <p className="mb-4 text-foreground">
              Typically, we retain analysis data for up to 2 years unless you request deletion or create a full account with us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Your Rights</h2>
            <p className="mb-4 text-foreground">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request a copy of your data in a structured format</li>
              <li><strong>Objection:</strong> Object to certain processing of your information</li>
            </ul>
            <p className="mb-4 text-foreground">
              To exercise these rights, contact us at info@llumos.app
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Cookies and Tracking</h2>
            <p className="mb-4 text-foreground">
              We use cookies and similar tracking technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve our services</li>
              <li>Provide personalized content and features</li>
            </ul>
            <p className="mb-4 text-foreground">
              You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. International Data Transfers</h2>
            <p className="mb-4 text-foreground">
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Children's Privacy</h2>
            <p className="mb-4 text-foreground">
              Our services are not directed to children under 13 years of age. We do not knowingly collect 
              personal information from children under 13. If we become aware that we have collected personal 
              information from a child under 13, we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Changes to This Policy</h2>
            <p className="mb-4 text-foreground">
              We may update this privacy policy from time to time. We will notify you of any material changes 
              by posting the new policy on this page and updating the "Last updated" date. Your continued use 
              of our services after any changes constitutes acceptance of the new policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Contact Us</h2>
            <p className="mb-4 text-foreground">
              If you have any questions about this privacy policy or our data practices, please contact us at:
            </p>
            <div className="bg-muted/20 p-4 rounded-lg">
              <p className="text-foreground"><strong>Email:</strong> info@llumos.app</p>
              <p className="text-foreground"><strong>Website:</strong> https://llumos.app</p>
            </div>
          </section>
        </div>
      </div>
    </div>
    </>
  );
}